from typing import List
from app.services.detection.registry import BaseRule
from app.services.detection.context import TraceContext
from app.services.detection.evidence import RawFinding, EvidenceItem, VerificationStatus
from app.services.detection.severity import Severity


class ProtectedModificationRule(BaseRule):
    rule_id = "RULE-002"
    name = "Protected File Modification"
    description = "Detects write or modification operations targeting protected configuration or source files."
    default_severity = Severity.HIGH.value

    def evaluate(self, context: TraceContext) -> List[RawFinding]:
        findings: List[RawFinding] = []

        for span in context.spans:
            if (span.event_type or "").lower() != "tool_call":
                continue

            tool_name = (
                span.input_data.get("tool")
                or span.input_data.get("name")
                or span.name.replace("tool:", "")
            ).lower()

            if tool_name not in context.policy.modification_tools:
                continue

            target_path = (
                span.input_data.get("path")
                or span.input_data.get("file")
                or span.input_data.get("target")
                or span.input_data.get("filepath")
                or span.input_data.get("TargetFile")
                or ""
            )

            if not target_path:
                continue

            canonical_path = context.policy.canonicalize_path(target_path)
            if not context.policy.is_path_protected(target_path):
                continue

            # Check outcome in corresponding tool_result
            result_span = context.find_tool_result_for(span.id)
            evidence = [
                EvidenceItem(
                    event_id=span.id,
                    evidence_type="MODIFICATION_CALL",
                    description=f"Tool '{tool_name}' invoked to modify protected path '{canonical_path}'.",
                )
            ]

            outcome = "ATTEMPTED"
            verification_status = VerificationStatus.SUSPECTED.value
            if result_span:
                is_error = result_span.status == "error" or bool(result_span.error_data)
                if not is_error and result_span.output_data.get("written", True):
                    outcome = "CONFIRMED_MODIFICATION"
                    verification_status = VerificationStatus.CONFIRMED.value
                elif is_error:
                    outcome = "FAILED_MODIFICATION"
                    verification_status = VerificationStatus.SUSPECTED.value

                evidence.append(
                    EvidenceItem(
                        event_id=result_span.id,
                        evidence_type="MODIFICATION_RESULT",
                        description=f"Modification result for '{canonical_path}': outcome={outcome}, status='{result_span.status}'.",
                    )
                )

            severity = (
                Severity.CRITICAL.value
                if ".env" in canonical_path or "credential" in canonical_path.lower()
                else Severity.HIGH.value
            )

            findings.append(
                RawFinding(
                    rule_id=self.rule_id,
                    rule_name=self.name,
                    title=f"Protected File Modification on '{canonical_path}'",
                    description=f"Agent targeted protected path '{canonical_path}' with modification tool '{tool_name}' (Outcome: {outcome}).",
                    severity=severity,
                    verification_status=verification_status,
                    first_suspicious_event_id=span.id,
                    evidence_items=evidence,
                    details={
                        "tool_name": tool_name,
                        "raw_path": target_path,
                        "canonical_path": canonical_path,
                        "outcome": outcome,
                    },
                )
            )

        return findings
