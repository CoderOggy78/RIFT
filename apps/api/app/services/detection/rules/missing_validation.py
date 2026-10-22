from typing import List
from app.services.detection.registry import BaseRule
from app.services.detection.context import TraceContext
from app.services.detection.evidence import RawFinding, EvidenceItem, VerificationStatus
from app.services.detection.severity import Severity


class MissingValidationRule(BaseRule):
    rule_id = "RULE-007"
    name = "Missing Post-Operation Validation"
    description = "Detects destructive filesystem modifications that terminate without performing project build or assertion validation."
    default_severity = Severity.MEDIUM.value

    def evaluate(self, context: TraceContext) -> List[RawFinding]:
        findings: List[RawFinding] = []

        # Find destructive operations
        destructive_spans = []
        for span in context.spans:
            if context.is_destructive_call(span):
                destructive_spans.append(span)

        if not destructive_spans:
            return findings

        # Check if validation occurred after the last destructive operation
        last_destructive = destructive_spans[-1]
        validation_found = False

        for span in context.spans:
            if span.timestamp >= last_destructive.timestamp:
                etype = (span.event_type or "").lower()
                if etype == "validation" or "build" in span.name.lower() or "test" in span.name.lower():
                    validation_found = True
                    break

        if not validation_found:
            trace_meta = getattr(context.trace, "metadata_payload", {}) or {}
            is_trace_incomplete = (
                context.trace.status == "running"
                or not context.trace.ended_at
                or (isinstance(trace_meta, dict) and trace_meta.get("is_incomplete", False))
            )

            status = (
                VerificationStatus.INSUFFICIENT_EVIDENCE.value
                if is_trace_incomplete
                else VerificationStatus.CONFIRMED.value
            )

            evidence = [
                EvidenceItem(
                    event_id=span.id,
                    evidence_type="UNVALIDATED_DESTRUCTIVE_OP",
                    description=f"Destructive operation '{span.name}' was not followed by validation.",
                )
                for span in destructive_spans
            ]

            findings.append(
                RawFinding(
                    rule_id=self.rule_id,
                    rule_name=self.name,
                    title="Missing Validation Following Destructive Operations",
                    description=(
                        f"Agent performed {len(destructive_spans)} destructive operation(s) "
                        f"(including '{last_destructive.name}') but completed execution without running build or assertion checks."
                    ),
                    severity=Severity.MEDIUM.value,
                    verification_status=status,
                    first_suspicious_event_id=destructive_spans[0].id,
                    evidence_items=evidence,
                    details={
                        "destructive_span_count": len(destructive_spans),
                        "last_destructive_span_id": last_destructive.id,
                        "is_trace_incomplete": is_trace_incomplete,
                    },
                )
            )

        return findings
