from typing import List, Dict, Any, Tuple
from app.models.models import Span, Detection
from app.services.ai.output_parser import HypothesisOutputItem, RemediationOutputItem
from app.services.ai.evidence_validator import EvidenceValidator, EvidenceValidationResult


class ProcessedHypothesis:
    def __init__(
        self,
        title: str,
        explanation: str,
        confidence_level: str,
        verification_status: str,
        suggested_check: str,
        rank: int,
        missing_evidence: List[str],
        supporting_events: List[str],
        contradicting_events: List[str],
        invalid_citations: List[str],
        validation_notes: List[str],
    ):
        self.title = title
        self.explanation = explanation
        self.confidence_level = confidence_level
        self.verification_status = verification_status
        self.suggested_check = suggested_check
        self.rank = rank
        self.missing_evidence = missing_evidence
        self.supporting_events = supporting_events
        self.contradicting_events = contradicting_events
        self.invalid_citations = invalid_citations
        self.validation_notes = validation_notes


class HypothesisValidator:
    def __init__(self, trace_spans: List[Span], trace_detections: List[Detection]):
        self.evidence_validator = EvidenceValidator(trace_spans, trace_detections)

    def process_hypotheses(
        self, raw_hypotheses: List[HypothesisOutputItem]
    ) -> List[ProcessedHypothesis]:
        """
        Validates, orders, and ranks candidate hypotheses.
        Prioritizes verified supported hypotheses first, then partially supported, unverified, and contradicted.
        """
        processed: List[ProcessedHypothesis] = []

        status_weights = {
            "supported": 4,
            "partially_supported": 3,
            "unverified": 2,
            "contradicted": 1,
        }

        confidence_weights = {
            "high": 3,
            "medium": 2,
            "low": 1,
        }

        for idx, hyp in enumerate(raw_hypotheses):
            val_res = self.evidence_validator.validate_hypothesis(hyp)

            item = ProcessedHypothesis(
                title=hyp.title.strip(),
                explanation=hyp.explanation.strip(),
                confidence_level=hyp.confidence,
                verification_status=val_res.verification_status,
                suggested_check=hyp.suggested_verification or "",
                rank=idx + 1,
                missing_evidence=hyp.missing_evidence or [],
                supporting_events=val_res.valid_supporting_ids,
                contradicting_events=val_res.valid_contradicting_ids,
                invalid_citations=val_res.invalid_cited_ids,
                validation_notes=val_res.validation_notes,
            )
            processed.append(item)

        # Sort by verification status weight desc, then confidence desc, preserving order
        processed.sort(
            key=lambda h: (
                status_weights.get(h.verification_status, 0),
                confidence_weights.get(h.confidence_level, 0),
            ),
            reverse=True,
        )

        # Re-assign rank numbers 1..N after sorting
        for new_rank, item in enumerate(processed, start=1):
            item.rank = new_rank

        return processed
