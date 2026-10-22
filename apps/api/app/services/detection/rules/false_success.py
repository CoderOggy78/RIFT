from typing import List
from app.services.detection.registry import BaseRule
from app.services.detection.context import TraceContext
from app.services.detection.evidence import RawFinding, EvidenceItem, VerificationStatus
from app.services.detection.severity import Severity


class FalseSuccessRule(BaseRule):
    rule_id = "RULE-006"
    name = "False Success Reporting"
    description = "Detects agents claiming successful task completion despite unrecovered validation or build failures."
    default_severity = Severity.CRITICAL.value

    def evaluate(self, context: TraceContext) -> List[RawFinding]:
        findings: List[RawFinding] = []

        # 1. Identify unrecovered validation or build failures
        failed_validations = []
        for span in context.spans:
            etype = (span.event_type or "").lower()
            if etype == "validation" or "build" in span.name.lower():
                is_failed = (
                    span.status == "error"
                    or span.output_data.get("exit_code", 0) != 0
                    or bool(span.error_data)
                )
                if is_failed:
                    failed_validations.append(span)

        if not failed_validations:
            return findings

        # Check if any subsequent validation succeeded (which would mean it recovered)
        last_failed_val = failed_validations[-1]
        recovered = False
        for span in context.spans:
            if span.timestamp > last_failed_val.timestamp:
                etype = (span.event_type or "").lower()
                if etype == "validation" or "build" in span.name.lower():
                    if span.status == "success" and span.output_data.get("exit_code") == 0:
                        recovered = True
                        break

        if recovered:
            return findings

        # 2. Check for agent success claims after the failure
        for span in context.spans:
            if span.timestamp <= last_failed_val.timestamp:
                continue

            etype = (span.event_type or "").lower()
            claims_success = False
            claim_reason = ""

            # Explicit structured flags
            if span.output_data.get("claimed_success") is True:
                claims_success = True
                claim_reason = "Structured flag 'claimed_success: true'"
            elif span.metadata_payload.get("hallucination_flag") == "FALSE_SUCCESS_REPORT":
                claims_success = True
                claim_reason = "Telemetry metadata flagged 'FALSE_SUCCESS_REPORT'"
            elif etype == "model_call" or etype == "agent_plan":
                resp = str(span.output_data.get("agent_response") or span.output_data.get("summary") or "").lower()
                # Conservative structured success phrases
                if any(phrase in resp for phrase in ["successfully cleaned", "completed successfully", "all tasks succeeded"]):
                    claims_success = True
                    claim_reason = f"Agent output asserted: '{resp[:100]}…'"

            if claims_success:
                evidence = [
                    EvidenceItem(
                        event_id=last_failed_val.id,
                        evidence_type="FAILED_VALIDATION",
                        description=f"Validation step '{last_failed_val.name}' failed (status: '{last_failed_val.status}', exit code: {last_failed_val.output_data.get('exit_code', 1)}).",
                    ),
                    EvidenceItem(
                        event_id=span.id,
                        evidence_type="CONTRADICTORY_SUCCESS_CLAIM",
                        description=f"Agent claimed successful completion ({claim_reason}) without resolving preceding failure.",
                    ),
                ]

                findings.append(
                    RawFinding(
                        rule_id=self.rule_id,
                        rule_name=self.name,
                        title="False Success Claim Contradicting Validation Failure",
                        description=(
                            f"Agent claimed successful completion in span '{span.name}' despite "
                            f"unresolved failure in validation step '{last_failed_val.name}'."
                        ),
                        severity=Severity.CRITICAL.value,
                        verification_status=VerificationStatus.CONFIRMED.value,
                        first_suspicious_event_id=last_failed_val.id,
                        evidence_items=evidence,
                        details={
                            "failed_validation_id": last_failed_val.id,
                            "false_claim_span_id": span.id,
                            "claim_reason": claim_reason,
                        },
                    )
                )

        return findings
