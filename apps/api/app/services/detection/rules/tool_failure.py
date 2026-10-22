from typing import List
from app.services.detection.registry import BaseRule
from app.services.detection.context import TraceContext
from app.services.detection.evidence import RawFinding, EvidenceItem, VerificationStatus
from app.services.detection.severity import Severity


class ToolFailureRule(BaseRule):
    rule_id = "RULE-004"
    name = "Failed Tool Execution"
    description = "Detects failed tool invocations, unhandled runtime exceptions, and non-zero validation outcomes."
    default_severity = Severity.HIGH.value

    def evaluate(self, context: TraceContext) -> List[RawFinding]:
        findings: List[RawFinding] = []

        for span in context.spans:
            is_failure = False
            failure_reasons: List[str] = []

            # 1. Explicit span status error
            if span.status == "error":
                is_failure = True
                failure_reasons.append(f"Span status is 'error'")

            # 2. error_data payload present
            if span.error_data and any(span.error_data.values()):
                is_failure = True
                err_code = span.error_data.get("code") or span.error_data.get("error")
                err_msg = span.error_data.get("stderr") or span.error_data.get("message")
                summary = f"{err_code}: {err_msg}" if err_code and err_msg else (err_code or err_msg or "Non-empty error_data")
                failure_reasons.append(str(summary)[:200])

            # 3. Nonzero exit code in output_data
            exit_code = span.output_data.get("exit_code")
            if exit_code is not None and exit_code != 0:
                is_failure = True
                failure_reasons.append(f"Non-zero exit code ({exit_code})")

            if is_failure:
                # Determine severity by event context
                etype = (span.event_type or "").lower()
                span_name = span.name.lower()

                if etype == "validation" or "build" in span_name or "test" in span_name:
                    severity = Severity.CRITICAL.value
                elif "permission" in str(failure_reasons).lower() or "eacces" in str(failure_reasons).lower():
                    severity = Severity.HIGH.value
                elif etype == "tool_result":
                    severity = Severity.HIGH.value
                else:
                    severity = Severity.MEDIUM.value

                evidence = [
                    EvidenceItem(
                        event_id=span.id,
                        evidence_type="EXECUTION_FAILURE",
                        description=f"Span '{span.name}' failed: {'; '.join(failure_reasons)}",
                    )
                ]

                # If this span is a tool_result or validation, cite parent tool_call if available
                if span.parent_span_id and span.parent_span_id in context.spans_by_id:
                    parent = context.spans_by_id[span.parent_span_id]
                    evidence.insert(
                        0,
                        EvidenceItem(
                            event_id=parent.id,
                            evidence_type="TRIGGERING_OPERATION",
                            description=f"Triggering operation: '{parent.name}'.",
                        ),
                    )

                findings.append(
                    RawFinding(
                        rule_id=self.rule_id,
                        rule_name=self.name,
                        title=f"Execution Failure in '{span.name}'",
                        description=f"Operation '{span.name}' failed with errors: {'; '.join(failure_reasons)}.",
                        severity=severity,
                        verification_status=VerificationStatus.CONFIRMED.value,
                        first_suspicious_event_id=span.id,
                        evidence_items=evidence,
                        details={
                            "span_name": span.name,
                            "event_type": span.event_type,
                            "failure_reasons": failure_reasons,
                            "exit_code": exit_code,
                        },
                    )
                )

        return findings
