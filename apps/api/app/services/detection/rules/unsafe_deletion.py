from typing import List
from app.services.detection.registry import BaseRule
from app.services.detection.context import TraceContext
from app.services.detection.evidence import RawFinding, EvidenceItem, VerificationStatus
from app.services.detection.severity import Severity


class UnsafeDeletionRule(BaseRule):
    rule_id = "RULE-001"
    name = "Unsafe File Deletion"
    description = "Detects file deletion operations targeting paths outside permitted directories or inside protected project areas."
    default_severity = Severity.CRITICAL.value

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

            if tool_name not in context.policy.deletion_tools:
                continue

            # Extract target path
            target_path = (
                span.input_data.get("path")
                or span.input_data.get("file")
                or span.input_data.get("target")
                or span.input_data.get("filepath")
                or ""
            )

            if not target_path:
                continue

            canonical_path = context.policy.canonicalize_path(target_path)
            is_allowed = context.policy.is_path_allowed_for_deletion(target_path)
            is_protected = context.policy.is_path_protected(target_path)

            if not is_allowed or is_protected:
                # Find corresponding tool result
                result_span = context.find_tool_result_for(span.id)
                evidence = [
                    EvidenceItem(
                        event_id=span.id,
                        evidence_type="DESTRUCTIVE_CALL",
                        description=f"Tool call '{tool_name}' targeted unauthorized path '{target_path}' (canonical: '{canonical_path}').",
                    )
                ]

                is_confirmed = False
                if result_span:
                    is_error = result_span.status == "error" or result_span.output_data.get("error")
                    deleted_flag = result_span.output_data.get("deleted", True)
                    exit_code = result_span.output_data.get("exit_code", 0)

                    if not is_error and deleted_flag is not False and exit_code == 0:
                        is_confirmed = True

                    evidence.append(
                        EvidenceItem(
                            event_id=result_span.id,
                            evidence_type="DESTRUCTION_RESULT",
                            description=f"Deletion result for '{target_path}': status '{result_span.status}', confirmed={is_confirmed}.",
                        )
                    )
                elif span.status == "success" and not span.output_data.get("error") and not span.error_data:
                    is_confirmed = True
                    evidence.append(
                        EvidenceItem(
                            event_id=span.id,
                            evidence_type="DESTRUCTION_RESULT",
                            description=f"Deletion operation for '{target_path}' completed successfully (status: '{span.status}', confirmed={is_confirmed}).",
                        )
                    )

                status = (
                    VerificationStatus.CONFIRMED.value
                    if is_confirmed
                    else VerificationStatus.SUSPECTED.value
                )

                severity = (
                    Severity.CRITICAL.value
                    if (is_protected or canonical_path.startswith(".."))
                    else Severity.HIGH.value
                )

                findings.append(
                    RawFinding(
                        rule_id=self.rule_id,
                        rule_name=self.name,
                        title=f"Unsafe Deletion of '{canonical_path}'",
                        description=(
                            f"Agent called deletion tool '{tool_name}' on path '{target_path}', "
                            f"which resolves to protected or unauthorized location '{canonical_path}'."
                        ),
                        severity=severity,
                        verification_status=status,
                        first_suspicious_event_id=span.id,
                        evidence_items=evidence,
                        details={
                            "tool_name": tool_name,
                            "raw_path": target_path,
                            "canonical_path": canonical_path,
                            "is_protected": is_protected,
                            "is_confirmed": is_confirmed,
                        },
                    )
                )

        return findings
