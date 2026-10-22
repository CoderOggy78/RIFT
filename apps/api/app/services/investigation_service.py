from typing import List, Dict, Any, Optional, Set
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.models import Trace, Span, Incident, Detection, EvidenceReference
from app.schemas.schemas import (
    GraphNodeResponse,
    GraphEdgeResponse,
    ExecutionGraphResponse,
    IntentDataResponse,
    ObservedExecutionResponse,
    IntentVsExecutionResponse,
    InvestigationStatsResponse,
    InvestigationContextResponse,
    EventDetailResponse,
    TraceDetailResponse,
    IncidentResponse,
    DetectionResponse,
    EvidenceReferenceResponse,
    SpanResponse,
)
from app.services.detection.policies import default_policy


class InvestigationService:
    @staticmethod
    def build_execution_graph(db: Session, trace_id: str) -> ExecutionGraphResponse:
        trace = db.query(Trace).filter(Trace.id == trace_id).first()
        if not trace:
            raise ValueError(f"Trace '{trace_id}' not found")

        spans: List[Span] = (
            db.query(Span)
            .filter(Span.trace_id == trace_id)
            .order_by(Span.timestamp.asc())
            .all()
        )

        detections: List[Detection] = (
            db.query(Detection).filter(Detection.trace_id == trace_id).all()
        )
        incidents: List[Incident] = (
            db.query(Incident).filter(Incident.trace_id == trace_id).all()
        )

        # Map span ID -> detections and severities
        span_detection_map: Dict[str, List[Detection]] = {}
        for det in detections:
            for ev in det.evidence:
                span_detection_map.setdefault(ev.event_id, []).append(det)

        first_suspicious_ids = {
            inc.first_suspicious_event_id for inc in incidents if inc.first_suspicious_event_id
        }

        # Calculate depths
        span_map = {s.id: s for s in spans}
        depth_cache: Dict[str, int] = {}

        def get_depth(span_id: str, visited: Set[str]) -> int:
            if span_id in depth_cache:
                return depth_cache[span_id]
            if span_id in visited:
                return 0
            visited.add(span_id)
            s = span_map.get(span_id)
            if not s or not s.parent_span_id or s.parent_span_id not in span_map:
                depth_cache[span_id] = 0
                return 0
            d = 1 + get_depth(s.parent_span_id, visited)
            depth_cache[span_id] = d
            return d

        for s in spans:
            get_depth(s.id, set())

        # Construct nodes
        nodes: List[GraphNodeResponse] = []
        root_event_ids: List[str] = []

        for s in spans:
            dets = span_detection_map.get(s.id, [])
            rule_ids = list({d.rule_id for d in dets})
            highest_sev = None
            if dets:
                highest_sev = dets[0].severity

            tool_name = None
            if (s.event_type or "").lower() == "tool_call":
                tool_name = (
                    s.input_data.get("tool")
                    or s.input_data.get("name")
                    or s.name.replace("tool:", "")
                )

            is_first = s.id in first_suspicious_ids
            inc_id = dets[0].incident_id if dets else None

            if not s.parent_span_id or s.parent_span_id not in span_map:
                root_event_ids.append(s.id)

            nodes.append(
                GraphNodeResponse(
                    id=s.id,
                    label=s.name,
                    event_type=s.event_type,
                    status=s.status,
                    duration_ms=s.duration_ms,
                    timestamp=s.timestamp,
                    tool_name=tool_name,
                    is_suspicious=len(dets) > 0 or is_first,
                    severity=highest_sev,
                    rule_ids=rule_ids,
                    is_first_suspicious=is_first,
                    incident_id=inc_id,
                    parent_span_id=s.parent_span_id,
                    depth=depth_cache.get(s.id, 0),
                )
            )

        # Construct edges with semantic relationships
        edges: List[GraphEdgeResponse] = []
        edge_id_set: Set[str] = set()

        def add_edge(
            source: str, target: str, relationship: str, label: Optional[str] = None, is_flagged: bool = False
        ):
            if source == target or source not in span_map or target not in span_map:
                return
            eid = f"edge-{source}-{target}-{relationship}"
            if eid in edge_id_set:
                return
            edge_id_set.add(eid)
            edges.append(
                GraphEdgeResponse(
                    id=eid,
                    source=source,
                    target=target,
                    relationship=relationship,
                    label=label,
                    is_flagged=is_flagged,
                )
            )

        # 1. Observed parent-child relationships
        for s in spans:
            if s.parent_span_id and s.parent_span_id in span_map:
                is_flagged = (s.id in span_detection_map) or (s.parent_span_id in span_detection_map)
                add_edge(s.parent_span_id, s.id, "parent_child", is_flagged=is_flagged)

        # 2. Explicit tool-call / tool-result pairings
        for s in spans:
            if (s.event_type or "").lower() == "tool_result":
                # Find matching tool_call
                call_span = None
                if s.parent_span_id and span_map.get(s.parent_span_id, {}).event_type == "tool_call":
                    call_span = span_map[s.parent_span_id]
                else:
                    # check previous tool_call with matching name
                    expected_tool = s.name.replace("result:", "").replace("tool_result:", "")
                    for prev in reversed(spans):
                        if prev.timestamp >= s.timestamp:
                            continue
                        if prev.event_type == "tool_call" and expected_tool in prev.name:
                            call_span = prev
                            break
                if call_span:
                    is_err = s.status == "error" or bool(s.error_data)
                    add_edge(
                        call_span.id,
                        s.id,
                        "tool_execution",
                        label="result",
                        is_flagged=is_err or s.id in span_detection_map,
                    )

        # 3. Explicit validation dependencies
        for s in spans:
            if (s.event_type or "").lower() == "validation":
                # Link to immediate preceding destructive or modifying tool calls
                for prev in reversed(spans):
                    if prev.timestamp >= s.timestamp:
                        continue
                    if prev.event_type in ("tool_call", "tool_result"):
                        add_edge(
                            prev.id,
                            s.id,
                            "validation_dependency",
                            label="verified by",
                            is_flagged=s.status == "error",
                        )
                        break

        # 4. Chronological sequence edges between root/top-level events
        if len(root_event_ids) > 1:
            for i in range(len(root_event_ids) - 1):
                add_edge(root_event_ids[i], root_event_ids[i + 1], "sequence", label="next")

        # 5. Inferred causal relationships (clearly labeled)
        for inc in incidents:
            if inc.first_suspicious_event_id and inc.first_suspicious_event_id in span_map:
                # Find downstream failure events
                first_event = span_map[inc.first_suspicious_event_id]
                for s in spans:
                    if s.timestamp > first_event.timestamp and (s.status == "error" or s.id in span_detection_map):
                        if s.id != first_event.id:
                            add_edge(
                                first_event.id,
                                s.id,
                                "inferred_causal",
                                label="suspected cause (inferred)",
                                is_flagged=True,
                            )
                            break  # Link to the immediate next critical consequence

        return ExecutionGraphResponse(
            trace_id=trace_id,
            nodes=nodes,
            edges=edges,
            root_event_ids=root_event_ids,
        )

    @staticmethod
    def get_investigation_context(db: Session, trace_id: str) -> InvestigationContextResponse:
        trace = db.query(Trace).filter(Trace.id == trace_id).first()
        if not trace:
            raise ValueError(f"Trace '{trace_id}' not found")

        spans: List[Span] = (
            db.query(Span)
            .filter(Span.trace_id == trace_id)
            .order_by(Span.timestamp.asc())
            .all()
        )

        detections: List[Detection] = (
            db.query(Detection).filter(Detection.trace_id == trace_id).all()
        )
        incidents: List[Incident] = (
            db.query(Incident).filter(Incident.trace_id == trace_id).all()
        )

        from app.services.trace_service import TraceService
        trace_detail = TraceService.get_trace_detail(db, trace_id)

        # Convert incidents
        incident_responses: List[IncidentResponse] = []
        for inc in incidents:
            incident_responses.append(
                IncidentResponse(
                    id=inc.id,
                    trace_id=inc.trace_id,
                    title=inc.title,
                    description=inc.description,
                    severity=inc.severity,
                    status=inc.status,
                    first_suspicious_event_id=inc.first_suspicious_event_id,
                    created_at=inc.created_at,
                    updated_at=inc.updated_at,
                    agent_name=trace.agent.name,
                    project_name=trace.project.name,
                    detection_count=len(inc.detections),
                )
            )

        # Convert detections
        detection_responses: List[DetectionResponse] = []
        for det in detections:
            evidence_responses = [
                EvidenceReferenceResponse(
                    id=ev.id,
                    detection_id=ev.detection_id,
                    trace_id=ev.trace_id,
                    event_id=ev.event_id,
                    evidence_type=ev.evidence_type,
                    description=ev.description,
                )
                for ev in det.evidence
            ]
            detection_responses.append(
                DetectionResponse(
                    id=det.id,
                    incident_id=det.incident_id,
                    trace_id=det.trace_id,
                    rule_id=det.rule_id,
                    title=det.title,
                    description=det.description,
                    severity=det.severity,
                    verification_status=det.verification_status,
                    details=det.details or {},
                    created_at=det.created_at,
                    evidence=evidence_responses,
                )
            )

        first_suspicious = None
        for inc in incidents:
            if inc.first_suspicious_event_id:
                first_suspicious = inc.first_suspicious_event_id
                break

        highest_sev = None
        if incidents:
            highest_sev = incidents[0].severity

        # Intent extraction
        user_instructions: List[str] = []
        declared_plan: Optional[str] = None
        for s in spans:
            if (s.event_type or "").lower() == "user_prompt":
                query = s.input_data.get("query") or s.input_data.get("prompt") or s.input_data.get("user")
                if query:
                    user_instructions.append(str(query))
            elif (s.event_type or "").lower() == "agent_plan":
                thought = s.input_data.get("thought") or s.output_data.get("plan") or s.output_data.get("steps")
                if thought:
                    declared_plan = str(thought)

        # Observed execution extraction
        destructive_ops: List[Dict[str, Any]] = []
        failed_ops: List[Dict[str, Any]] = []
        failed_validations: List[Dict[str, Any]] = []
        unexpected_state_changes: List[Dict[str, Any]] = []

        for s in spans:
            ev_type = (s.event_type or "").lower()
            tool_name = (
                s.input_data.get("tool")
                or s.input_data.get("name")
                or s.name.replace("tool:", "")
            ).lower()

            if tool_name in default_policy.deletion_tools or tool_name in default_policy.modification_tools:
                target_path = (
                    s.input_data.get("path")
                    or s.input_data.get("file")
                    or s.input_data.get("target")
                    or ""
                )
                destructive_ops.append({
                    "event_id": s.id,
                    "tool": tool_name,
                    "target_path": target_path,
                    "timestamp": s.timestamp.isoformat(),
                    "status": s.status,
                    "is_protected": default_policy.is_path_protected(target_path),
                })

            if s.status == "error" or bool(s.error_data):
                failed_ops.append({
                    "event_id": s.id,
                    "name": s.name,
                    "event_type": s.event_type,
                    "status": s.status,
                    "error": s.error_data or s.output_data.get("error"),
                    "timestamp": s.timestamp.isoformat(),
                })

            if ev_type == "validation" and (s.status == "error" or s.output_data.get("passed") is False):
                failed_validations.append({
                    "event_id": s.id,
                    "name": s.name,
                    "output": s.output_data,
                    "timestamp": s.timestamp.isoformat(),
                })

            if "manifest" in s.output_data or "diff" in s.output_data:
                unexpected_state_changes.append({
                    "event_id": s.id,
                    "name": s.name,
                    "data": s.output_data,
                })

        findings_list = [
            {
                "rule_id": d.rule_id,
                "title": d.title,
                "severity": d.severity,
                "description": d.description,
                "verification_status": d.verification_status,
                "evidence_events": [ev.event_id for ev in d.evidence],
            }
            for d in detections
        ]

        has_deviations = (
            len(destructive_ops) > 0
            or len(failed_ops) > 0
            or len(failed_validations) > 0
            or len(findings_list) > 0
        )

        intent_vs_exec = IntentVsExecutionResponse(
            intent=IntentDataResponse(
                user_objective=trace.objective,
                explicit_instructions=user_instructions,
                declared_plan=declared_plan,
            ),
            observed=ObservedExecutionResponse(
                destructive_operations=destructive_ops,
                failed_operations=failed_ops,
                failed_validations=failed_validations,
                unexpected_state_changes=unexpected_state_changes,
                findings=findings_list,
            ),
            has_deviations=has_deviations,
        )

        suspicious_count = len({ev.event_id for d in detections for ev in d.evidence})

        return InvestigationContextResponse(
            trace=trace_detail,
            incidents=incident_responses,
            detections=detection_responses,
            first_suspicious_event_id=first_suspicious,
            highest_severity=highest_sev,
            intent_vs_execution=intent_vs_exec,
            stats=InvestigationStatsResponse(
                total_spans=len(spans),
                failed_spans=len(failed_ops),
                suspicious_spans=suspicious_count,
                incident_count=len(incidents),
            ),
        )

    @staticmethod
    def get_event_detail(db: Session, trace_id: str, event_id: str) -> EventDetailResponse:
        span = (
            db.query(Span)
            .filter(Span.trace_id == trace_id, Span.id == event_id)
            .first()
        )
        if not span:
            raise ValueError(f"Event '{event_id}' not found in trace '{trace_id}'")

        all_spans = (
            db.query(Span)
            .filter(Span.trace_id == trace_id)
            .all()
        )
        span_map = {s.id: s for s in all_spans}

        # Compute ancestor chain
        ancestors: List[str] = []
        curr = span.parent_span_id
        visited: Set[str] = set()
        while curr and curr in span_map and curr not in visited:
            ancestors.append(curr)
            visited.add(curr)
            curr = span_map[curr].parent_span_id

        # Direct children
        child_ids = [s.id for s in all_spans if s.parent_span_id == event_id]

        # Transitive descendants
        descendants: List[str] = []
        queue = list(child_ids)
        visited_desc: Set[str] = set(queue)
        while queue:
            next_id = queue.pop(0)
            descendants.append(next_id)
            for s in all_spans:
                if s.parent_span_id == next_id and s.id not in visited_desc:
                    visited_desc.add(s.id)
                    queue.append(s.id)

        # Detections citing this event
        citing_detections = (
            db.query(Detection)
            .join(EvidenceReference, Detection.id == EvidenceReference.detection_id)
            .filter(EvidenceReference.trace_id == trace_id, EvidenceReference.event_id == event_id)
            .all()
        )

        # Check if first suspicious
        is_first = (
            db.query(Incident)
            .filter(Incident.trace_id == trace_id, Incident.first_suspicious_event_id == event_id)
            .count()
            > 0
        )

        detection_responses: List[DetectionResponse] = []
        for det in citing_detections:
            evidence_responses = [
                EvidenceReferenceResponse(
                    id=ev.id,
                    detection_id=ev.detection_id,
                    trace_id=ev.trace_id,
                    event_id=ev.event_id,
                    evidence_type=ev.evidence_type,
                    description=ev.description,
                )
                for ev in det.evidence
            ]
            detection_responses.append(
                DetectionResponse(
                    id=det.id,
                    incident_id=det.incident_id,
                    trace_id=det.trace_id,
                    rule_id=det.rule_id,
                    title=det.title,
                    description=det.description,
                    severity=det.severity,
                    verification_status=det.verification_status,
                    details=det.details or {},
                    created_at=det.created_at,
                    evidence=evidence_responses,
                )
            )

        return EventDetailResponse(
            span=SpanResponse.model_validate(span),
            ancestor_ids=ancestors,
            child_ids=child_ids,
            descendant_ids=descendants,
            cited_in_detections=detection_responses,
            is_first_suspicious=is_first,
        )
