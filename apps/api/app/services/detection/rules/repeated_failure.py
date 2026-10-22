import json
from typing import List, Dict, Any, Tuple
from app.services.detection.registry import BaseRule
from app.services.detection.context import TraceContext
from app.services.detection.evidence import RawFinding, EvidenceItem, VerificationStatus
from app.services.detection.severity import Severity


class RepeatedFailureRule(BaseRule):
    rule_id = "RULE-005"
    name = "Repeated Failure Loop"
    description = "Detects repeated consecutive failing tool calls with identical or semantically equivalent arguments."
    default_severity = Severity.HIGH.value

    @staticmethod
    def normalize_arguments(args: Dict[str, Any]) -> str:
        """Create a stable hashable key from tool arguments, omitting transient fields."""
        filtered = {}
        for k, v in args.items():
            if k.lower() in ("timestamp", "nonce", "request_id", "session_id", "id"):
                continue
            filtered[k.lower()] = str(v)
        return json.dumps(filtered, sort_keys=True)

    def evaluate(self, context: TraceContext) -> List[RawFinding]:
        findings: List[RawFinding] = []
        threshold = context.policy.repeated_failure_threshold

        # Track consecutive failing sequences
        tool_calls = [s for s in context.spans if (s.event_type or "").lower() == "tool_call"]
        if len(tool_calls) < threshold:
            return findings

        # Group runs of failing identical calls
        current_signature = None
        current_streak: List[Tuple[Any, Any]] = []  # (tool_call_span, tool_result_span)

        for tc in tool_calls:
            tool_name = (
                tc.input_data.get("tool")
                or tc.input_data.get("name")
                or tc.name.replace("tool:", "")
            ).lower()
            arg_sig = self.normalize_arguments(tc.input_data)
            call_sig = f"{tool_name}::{arg_sig}"

            result = context.find_tool_result_for(tc.id)
            is_error = False
            if result:
                is_error = result.status == "error" or bool(result.error_data) or result.output_data.get("exit_code", 0) != 0
            elif tc.status == "error":
                is_error = True

            if is_error:
                if call_sig == current_signature:
                    current_streak.append((tc, result))
                else:
                    if len(current_streak) >= threshold:
                        findings.append(self._create_loop_finding(current_signature, current_streak))
                    current_signature = call_sig
                    current_streak = [(tc, result)]
            else:
                if len(current_streak) >= threshold:
                    findings.append(self._create_loop_finding(current_signature, current_streak))
                current_signature = None
                current_streak = []

        if len(current_streak) >= threshold:
            findings.append(self._create_loop_finding(current_signature, current_streak))

        return findings

    def _create_loop_finding(self, signature: str, streak: List[Tuple[Any, Any]]) -> RawFinding:
        tool_name = signature.split("::")[0] if signature else "tool"
        count = len(streak)
        evidence = []

        for idx, (tc, tr) in enumerate(streak):
            evidence.append(
                EvidenceItem(
                    event_id=tc.id,
                    evidence_type="LOOP_CALL",
                    description=f"Attempt {idx + 1} of {count}: '{tool_name}' failed.",
                )
            )
            if tr:
                evidence.append(
                    EvidenceItem(
                        event_id=tr.id,
                        evidence_type="LOOP_FAILURE",
                        description=f"Attempt {idx + 1} error result: '{tr.name}'.",
                    )
                )

        return RawFinding(
            rule_id=self.rule_id,
            rule_name=self.name,
            title=f"Repeated Failure Loop in Tool '{tool_name}' ({count}x)",
            description=f"Agent entered a failure loop executing '{tool_name}' {count} times consecutively with equivalent failing arguments.",
            severity=Severity.HIGH.value,
            verification_status=VerificationStatus.CONFIRMED.value,
            first_suspicious_event_id=streak[0][0].id,
            evidence_items=evidence,
            details={
                "tool_name": tool_name,
                "repetition_count": count,
                "involved_call_ids": [tc.id for tc, _ in streak],
            },
        )
