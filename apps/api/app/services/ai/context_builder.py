import json
from typing import Dict, Any, List, Set, Optional
from app.models.models import Incident, Trace, Span, Detection
from app.services.ai.redaction import redact_payload
from app.services.ai.token_budget import TokenBudgetManager


class ContextBuilder:
    def __init__(self, max_context_tokens: int = 8192):
        self.budget_manager = TokenBudgetManager(max_context_tokens=max_context_tokens)

    def build_evidence_package(
        self,
        incident: Incident,
        trace: Trace,
        detections: List[Detection],
        spans: List[Span],
        first_suspicious_event_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Constructs a prioritized, redacted, bounded evidence package for Gemma inference.
        """
        # Step 1: Prioritize event IDs
        high_priority_ids: Set[str] = set()

        if first_suspicious_event_id:
            high_priority_ids.add(first_suspicious_event_id)

        # Cited events from detections
        for det in detections:
            for ev in getattr(det, "evidence", []):
                high_priority_ids.add(ev.event_id)

        # Error spans
        for s in spans:
            if s.status == "error" or (s.error_data and bool(s.error_data)):
                high_priority_ids.add(s.id)

        # Roots (user prompts) and planning events
        for s in spans:
            if s.event_type in ("user_prompt", "agent_plan") and not s.parent_span_id:
                high_priority_ids.add(s.id)

        # Step 2: Include direct parents and direct children of high-priority events
        expanded_ids = set(high_priority_ids)
        span_map = {s.id: s for s in spans}

        for eid in high_priority_ids:
            s = span_map.get(eid)
            if s and s.parent_span_id:
                expanded_ids.add(s.parent_span_id)
            # direct children
            for child in spans:
                if child.parent_span_id == eid:
                    expanded_ids.add(child.id)

        # Step 3: Sort chronologically
        selected_spans = [s for s in spans if s.id in expanded_ids]
        selected_spans.sort(key=lambda s: s.timestamp)

        # If trace is very large, enforce maximum count of selected spans (e.g. 50 max)
        max_spans_limit = 50
        is_truncated = False
        if len(selected_spans) > max_spans_limit:
            is_truncated = True
            # Keep highest priority first, then slice
            crucial = [s for s in selected_spans if s.id in high_priority_ids]
            others = [s for s in selected_spans if s.id not in high_priority_ids]
            selected_spans = crucial + others[: (max_spans_limit - len(crucial))]
            selected_spans.sort(key=lambda s: s.timestamp)

        omitted_count = max(0, len(spans) - len(selected_spans))

        # Step 4: Serialize selected spans with bounded fields and redaction
        serialized_spans: List[Dict[str, Any]] = []
        for s in selected_spans:
            redacted_input = self.budget_manager.truncate_field_value(
                redact_payload(s.input_data or {})
            )
            redacted_output = self.budget_manager.truncate_field_value(
                redact_payload(s.output_data or {})
            )
            redacted_error = self.budget_manager.truncate_field_value(
                redact_payload(s.error_data or {})
            )

            serialized_spans.append({
                "event_id": s.id,
                "parent_span_id": s.parent_span_id,
                "event_type": s.event_type,
                "name": s.name,
                "timestamp": s.timestamp.isoformat() if hasattr(s.timestamp, "isoformat") else str(s.timestamp),
                "duration_ms": s.duration_ms,
                "status": s.status,
                "inputs": redacted_input,
                "outputs": redacted_output,
                "error": redacted_error,
            })

        # Step 5: Serialize detection findings
        serialized_detections: List[Dict[str, Any]] = []
        for det in detections:
            cited_ids = [ev.event_id for ev in getattr(det, "evidence", [])]
            serialized_detections.append({
                "rule_id": det.rule_id,
                "title": det.title,
                "severity": det.severity,
                "description": det.description,
                "cited_event_ids": cited_ids,
            })

        # Step 6: Assemble final package
        evidence_package = {
            "incident": {
                "id": incident.id,
                "title": incident.title,
                "description": incident.description,
                "severity": incident.severity,
                "status": incident.status,
                "first_suspicious_event_id": first_suspicious_event_id,
            },
            "trace_context": {
                "id": trace.id,
                "agent_name": trace.agent.name if getattr(trace, "agent", None) else getattr(trace, "agent_name", "Unknown"),
                "agent_framework": trace.agent.framework if getattr(trace, "agent", None) else getattr(trace, "agent_framework", None),
                "user_objective": redact_payload(trace.objective),
                "status": trace.status,
                "started_at": trace.started_at.isoformat() if hasattr(trace.started_at, "isoformat") else str(trace.started_at),
                "duration_ms": (
                    max(0.0, (trace.ended_at - trace.started_at).total_seconds() * 1000)
                    if getattr(trace, "ended_at", None) and getattr(trace, "started_at", None)
                    else None
                ),
            },
            "deterministic_detections": serialized_detections,
            "telemetry_events": serialized_spans,
            "metadata": {
                "total_trace_spans": len(spans),
                "included_events_count": len(serialized_spans),
                "omitted_events_count": omitted_count,
                "is_truncated": is_truncated,
            },
        }

        # Step 7: Optional Codebase Knowledge (Graphify)
        try:
            from app.services.code_knowledge import code_knowledge_service
            ck_status = code_knowledge_service.get_status()
            if ck_status.status == "ready":
                # Check if telemetry spans touched any files
                touched_files = set()
                file_changes = {}
                for s in spans:
                    inp = getattr(s, "input_data", {}) or {}
                    out = getattr(s, "output_data", {}) or {}
                    meta = getattr(s, "metadata", {}) or {}
                    sname = (getattr(s, "name", "") or "").lower()
                    for k in ("path", "file_path", "target_file", "file", "affected_path"):
                        val = inp.get(k) or out.get(k) or meta.get(k)
                        if isinstance(val, str) and val.strip():
                            clean_val = val.replace("\\", "/").strip().lstrip("/")
                            touched_files.add(clean_val)
                            if "delete" in sname or "rm" in sname or inp.get("tool") == "delete_file" or out.get("deleted") is True:
                                file_changes[clean_val] = "delete"
                            elif clean_val not in file_changes:
                                file_changes[clean_val] = "modify"

                impact_summaries = []
                impact_evidence_items = []
                idx = 1
                for tf in sorted(list(touched_files))[:3]:
                    try:
                        ch_t = file_changes.get(tf, "modify")
                        imp_res = code_knowledge_service.analyze_impact(tf, change_type=ch_t, max_depth=2, max_results=10)
                        if imp_res.status == "success" and (imp_res.direct_impact_count > 0 or imp_res.relationships):
                            impact_summaries.append({
                                "target": tf,
                                "change_type": ch_t,
                                "summary": imp_res.summary,
                                "direct_impact_count": imp_res.direct_impact_count,
                                "affected_files": imp_res.affected_files[:5],
                                "relationships": [
                                    {
                                        "source": r.source,
                                        "target": r.target,
                                        "relation": r.relation,
                                        "confidence": r.confidence,
                                        "source_file": r.source_file,
                                        "source_location": r.source_location,
                                        "explanation": r.relevance_explanation,
                                    }
                                    for r in imp_res.relationships[:5]
                                ],
                            })
                            impact_evidence_items.append({
                                "evidence_id": f"ev-code-imp-{idx}",
                                "type": "codebase_impact_analysis",
                                "target_file": tf,
                                "change_type": ch_t,
                                "target_status": "CHANGE OBSERVED",
                                "impact_status": "POTENTIAL IMPACT",
                                "direct_dependents": imp_res.direct_impact_count,
                                "transitive_dependents": imp_res.transitive_impact_count,
                                "affected_files": imp_res.affected_files[:5],
                                "summary": imp_res.summary,
                                "provenance": "graphify-ast-extracted",
                                "disclaimer": "Predicted potential impact; not proof of verified failure until validated by tests.",
                            })
                            idx += 1
                    except Exception:
                        continue

                query_terms = [incident.title or ""]
                for det in detections:
                    if getattr(det, "rule_id", None):
                        query_terms.append(det.rule_id)
                query_str = " ".join(query_terms)[:200]
                q_res = code_knowledge_service.query(query_str, budget=1500)

                ck_payload = {
                    "status": "ready",
                    "provenance": "graphify-ast-extracted",
                    "summary": q_res.raw_summary if q_res.nodes else "Codebase graph queried.",
                    "relevant_entities": [
                        {
                            "id": n.id,
                            "label": n.label,
                            "file_type": n.file_type,
                            "source_file": n.source_file,
                            "source_location": n.source_location,
                        }
                        for n in (q_res.nodes[:15] if q_res.nodes else [])
                    ],
                    "relationships": [
                        {
                            "source": e.source,
                            "target": e.target,
                            "relation": e.relation,
                            "confidence": e.confidence,
                            "source_file": e.source_file,
                            "source_location": e.source_location,
                        }
                        for e in (q_res.edges[:25] if q_res.edges else [])
                    ],
                }
                if impact_summaries:
                    ck_payload["impact_analysis"] = impact_summaries
                if impact_evidence_items:
                    ck_payload["supplementary_evidence"] = impact_evidence_items

                evidence_package["codebase_knowledge"] = ck_payload
        except Exception:
            pass

        return evidence_package

    def serialize_to_json(self, evidence_package: Dict[str, Any]) -> str:
        """Serializes evidence package to formatted JSON string."""
        return json.dumps(evidence_package, indent=2)
