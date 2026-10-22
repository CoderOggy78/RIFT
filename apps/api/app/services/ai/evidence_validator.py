from typing import List, Dict, Set, Optional, Tuple, Literal, Any
from app.models.models import Span, Detection
from app.services.ai.output_parser import HypothesisOutputItem


class EvidenceValidationResult:
    def __init__(
        self,
        hypothesis_title: str,
        valid_supporting_ids: List[str],
        valid_contradicting_ids: List[str],
        invalid_cited_ids: List[str],
        verification_status: Literal["supported", "partially_supported", "unverified", "contradicted"],
        validation_notes: List[str],
        validated_code_citations: Optional[List[Dict[str, Any]]] = None,
    ):
        self.hypothesis_title = hypothesis_title
        self.valid_supporting_ids = valid_supporting_ids
        self.valid_contradicting_ids = valid_contradicting_ids
        self.invalid_cited_ids = invalid_cited_ids
        self.verification_status = verification_status
        self.validation_notes = validation_notes
        self.validated_code_citations = validated_code_citations or []


class EvidenceValidator:
    def __init__(self, trace_spans: List[Span], trace_detections: List[Detection]):
        self.trace_spans = trace_spans
        self.span_map: Dict[str, Span] = {s.id: s for s in trace_spans}
        self.detections = trace_detections

        # Set of event IDs cited by deterministic detection rules
        self.detection_cited_ids: Set[str] = set()
        for det in trace_detections:
            for ev in getattr(det, "evidence", []):
                self.detection_cited_ids.add(ev.event_id)

    def validate_event_id(self, event_id: str) -> bool:
        """Returns True if the event exists in the target trace."""
        return event_id in self.span_map

    def validate_first_suspicious_event(
        self, candidate_id: Optional[str]
    ) -> Tuple[Optional[str], bool]:
        """
        Validates the claimed first_suspicious_event_id.
        Returns (event_id, is_valid).
        """
        if not candidate_id:
            return None, True

        if candidate_id not in self.span_map:
            return None, False

        return candidate_id, True

    def validate_hypothesis(
        self, hypothesis: HypothesisOutputItem
    ) -> EvidenceValidationResult:
        """
        Validates all event citations in a hypothesis and determines its verification status.
        Never automatically assigns 'supported' merely because citations exist.
        """
        valid_supporting: List[str] = []
        valid_contradicting: List[str] = []
        invalid_ids: List[str] = []
        notes: List[str] = []

        # Validate supporting citations
        for eid in hypothesis.supporting_event_ids:
            if self.validate_event_id(eid):
                valid_supporting.append(eid)
            else:
                invalid_ids.append(eid)
                notes.append(f"Cited event '{eid}' does not exist in trace.")

        # Validate contradicting citations
        for eid in hypothesis.contradicting_event_ids:
            if self.validate_event_id(eid):
                valid_contradicting.append(eid)
            else:
                invalid_ids.append(eid)
                notes.append(f"Contradicting event '{eid}' does not exist in trace.")

        # Determine Verification Status
        # Rule 1: Genuine contradiction present in trace
        if valid_contradicting:
            verification_status = "contradicted"
            notes.append("Hypothesis has verified contradicting telemetry.")

        # Rule 2: Ground-truth corroboration with deterministic detections
        elif valid_supporting and any(eid in self.detection_cited_ids for eid in valid_supporting):
            # If the model acknowledged missing evidence, it is only partially supported
            if hypothesis.missing_evidence and len(hypothesis.missing_evidence) > 0:
                verification_status = "partially_supported"
                notes.append("Corroborated by deterministic rules, but missing evidence was cited.")
            else:
                verification_status = "supported"
                notes.append("Corroborated by deterministic detection rule evidence.")

        # Rule 3: Valid citations present, but no deterministic detection matches
        elif valid_supporting:
            if hypothesis.missing_evidence and len(hypothesis.missing_evidence) > 0:
                verification_status = "partially_supported"
            else:
                verification_status = "unverified"
            notes.append("Events exist in trace but claim cannot be mechanically verified.")

        # Rule 4: No valid supporting citations
        else:
            verification_status = "unverified"
            notes.append("No valid trace events cited to support claim.")

        # Step 4: Validate Code Citations
        validated_code_citations: List[Dict[str, Any]] = []
        for cit in getattr(hypothesis, "code_citations", []):
            if isinstance(cit, str):
                parts = cit.split(":")
                fpath = parts[0].strip()
                line_no = None
                if len(parts) > 1:
                    try:
                        line_no = int(parts[1].replace("L", "").replace("l", ""))
                    except ValueError:
                        pass
                cit_dict = {"file_path": fpath, "line_number": line_no}
            elif isinstance(cit, dict):
                cit_dict = cit
            else:
                continue

            fpath = cit_dict.get("file_path", "")
            lno = cit_dict.get("line_number")
            sym = cit_dict.get("symbol")

            try:
                from app.services.code_knowledge import code_knowledge_service
                is_valid, note = code_knowledge_service.verify_code_citation(fpath, lno)
            except Exception as e:
                is_valid, note = False, str(e)

            validated_code_citations.append({
                "file_path": fpath,
                "line_number": lno,
                "symbol": sym,
                "verified": is_valid,
                "notes": note,
            })
            if is_valid:
                notes.append(f"Verified source code citation: {fpath}:{lno or ''}")
            else:
                notes.append(f"Unverified source code citation '{fpath}': {note}")

        return EvidenceValidationResult(
            hypothesis_title=hypothesis.title,
            valid_supporting_ids=valid_supporting,
            valid_contradicting_ids=valid_contradicting,
            invalid_cited_ids=invalid_ids,
            verification_status=verification_status,
            validation_notes=notes,
            validated_code_citations=validated_code_citations,
        )
