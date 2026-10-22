import uuid
from typing import List, Dict, Optional, Set, Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.models import Trace, Span, Incident, Detection, EvidenceReference
from app.services.detection.context import TraceContext
from app.services.detection.policies import DetectionPolicy, default_policy
from app.services.detection.registry import registry
from app.services.detection.evidence import RawFinding
from app.services.detection.severity import max_severity, compare_severity, Severity

# Import rules to ensure registration
import app.services.detection.rules


class DetectionEngine:
    @staticmethod
    def run_detection(
        db: Session,
        trace_id: str,
        policy: Optional[DetectionPolicy] = None,
    ) -> List[Incident]:
        """
        Executes all registered deterministic detection rules against an imported trace.
        Correlates raw findings into incidents and idempotently persists results.
        """
        trace = db.query(Trace).filter(Trace.id == trace_id).first()
        if not trace:
            raise ValueError(f"Trace '{trace_id}' not found")

        spans = (
            db.query(Span)
            .filter(Span.trace_id == trace_id)
            .order_by(Span.timestamp.asc())
            .all()
        )

        context = TraceContext(trace=trace, spans=spans, policy=policy or default_policy)

        # 1. Run all registered deterministic rules
        raw_findings: List[RawFinding] = []
        for rule in registry.list_rules():
            try:
                rule_findings = rule.evaluate(context)
                raw_findings.extend(rule_findings)
            except Exception as e:
                # Rules must not crash the engine
                print(f"[!] Warning: Rule {rule.rule_id} raised exception: {e}")

        # 2. Idempotent cleanup of prior detections for this trace
        existing_incidents = db.query(Incident).filter(Incident.trace_id == trace_id).all()
        for inc in existing_incidents:
            db.delete(inc)
        db.flush()

        if not raw_findings:
            db.commit()
            return []

        # 3. Correlation algorithm: group related findings by shared event IDs and span tree
        incident_clusters = DetectionEngine._correlate_findings(raw_findings, context)

        persisted_incidents: List[Incident] = []
        for cluster in incident_clusters:
            # Determine incident severity as max of findings
            cluster_severities = [f.severity for f in cluster]
            incident_severity = max_severity(cluster_severities)

            # Sort cluster findings by severity descending so primary title is prominent
            sorted_cluster = sorted(
                cluster,
                key=lambda f: (-compare_severity(f.severity, Severity.INFORMATIONAL.value), f.rule_id),
            )
            primary_finding = sorted_cluster[0]

            # Determine earliest cited suspicious event from active findings
            earliest_event_id = None
            earliest_time = None

            for finding in cluster:
                candidate_id = finding.first_suspicious_event_id
                if candidate_id and candidate_id in context.spans_by_id:
                    span_rec = context.spans_by_id[candidate_id]
                    if earliest_time is None or span_rec.timestamp < earliest_time:
                        earliest_time = span_rec.timestamp
                        earliest_event_id = span_rec.id

            if not earliest_event_id and primary_finding.first_suspicious_event_id:
                earliest_event_id = primary_finding.first_suspicious_event_id

            # Create Incident
            rule_names = sorted(list({f.rule_name for f in cluster}))
            title = primary_finding.title
            if len(cluster) > 1:
                title = f"{primary_finding.title} (+{len(cluster) - 1} correlated findings)"

            description = (
                f"Deterministic incident triggered by {len(cluster)} detection(s): "
                f"{', '.join(rule_names)}.\nPrimary observation: {primary_finding.description}"
            )

            incident_id = f"inc-{uuid.uuid4().hex[:12]}"
            incident = Incident(
                id=incident_id,
                trace_id=trace.id,
                title=title,
                description=description,
                severity=incident_severity,
                status="Open",
                first_suspicious_event_id=earliest_event_id,
            )
            db.add(incident)
            db.flush()

            # Create Detections and Evidence References
            for finding in cluster:
                det_id = f"det-{uuid.uuid4().hex[:12]}"
                detection = Detection(
                    id=det_id,
                    incident_id=incident.id,
                    trace_id=trace.id,
                    rule_id=finding.rule_id,
                    title=finding.title,
                    description=finding.description,
                    severity=finding.severity,
                    verification_status=finding.verification_status,
                    details=finding.details,
                )
                db.add(detection)
                db.flush()

                for ev in finding.evidence_items:
                    ev_ref = EvidenceReference(
                        id=f"ev-{uuid.uuid4().hex[:12]}",
                        detection_id=detection.id,
                        trace_id=trace.id,
                        event_id=ev.event_id,
                        evidence_type=ev.evidence_type,
                        description=ev.description,
                    )
                    db.add(ev_ref)

            persisted_incidents.append(incident)

        db.commit()
        return persisted_incidents

    @staticmethod
    def _correlate_findings(findings: List[RawFinding], context: TraceContext) -> List[List[RawFinding]]:
        """
        Groups findings into correlated clusters based on:
        - Direct shared event IDs
        - Parent-child tree adjacency
        - Common execution lineage
        """
        if not findings:
            return []

        # Build mapping of finding index to set of associated span IDs (including ancestors)
        finding_spans: List[Set[str]] = []
        for f in findings:
            span_ids: Set[str] = set()
            for ev in f.evidence_items:
                span_ids.add(ev.event_id)
                for anc in context.get_ancestors(ev.event_id):
                    span_ids.add(anc.id)
            if f.first_suspicious_event_id:
                span_ids.add(f.first_suspicious_event_id)
            finding_spans.append(span_ids)

        # Disjoint set / union-find grouping
        clusters: List[List[RawFinding]] = []
        cluster_span_sets: List[Set[str]] = []

        for idx, finding in enumerate(findings):
            spans_for_f = finding_spans[idx]
            matched_cluster_idx = None

            for c_idx, c_spans in enumerate(cluster_span_sets):
                # If they share any span in common, correlate into the same incident
                if c_spans.intersection(spans_for_f):
                    matched_cluster_idx = c_idx
                    break

            if matched_cluster_idx is not None:
                clusters[matched_cluster_idx].append(finding)
                cluster_span_sets[matched_cluster_idx].update(spans_for_f)
            else:
                clusters.append([finding])
                cluster_span_sets.append(set(spans_for_f))

        return clusters

    @staticmethod
    def get_summary(db: Session) -> Dict[str, Any]:
        """Calculates incident metrics derived strictly from persisted SQLite records."""
        total_incidents = db.query(func.count(Incident.id)).scalar() or 0
        critical_incidents = (
            db.query(func.count(Incident.id)).filter(Incident.severity == Severity.CRITICAL.value).scalar()
            or 0
        )
        high_incidents = (
            db.query(func.count(Incident.id)).filter(Incident.severity == Severity.HIGH.value).scalar()
            or 0
        )
        open_incidents = (
            db.query(func.count(Incident.id)).filter(Incident.status == "Open").scalar() or 0
        )
        resolved_incidents = (
            db.query(func.count(Incident.id)).filter(Incident.status == "Resolved").scalar() or 0
        )
        traces_with_incidents = (
            db.query(func.count(func.distinct(Incident.trace_id))).scalar() or 0
        )

        return {
            "total_incidents": total_incidents,
            "critical_incidents": critical_incidents,
            "high_incidents": high_incidents,
            "open_incidents": open_incidents,
            "resolved_incidents": resolved_incidents,
            "traces_with_incidents": traces_with_incidents,
        }
