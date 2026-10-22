from typing import List, Dict, Any
from app.services.detection.registry import BaseRule
from app.services.detection.context import TraceContext
from app.services.detection.evidence import RawFinding, EvidenceItem, VerificationStatus
from app.services.detection.severity import Severity


class InvalidArgumentsRule(BaseRule):
    rule_id = "RULE-003"
    name = "Invalid Tool Arguments"
    description = "Detects tool invocations with missing required parameters, malformed arguments, or type violations."
    default_severity = Severity.MEDIUM.value

    # Standard tool parameter expectations
    SCHEMA_EXPECTATIONS = {
        "delete_file": {"required_str": ["path"]},
        "write_file": {"required_str": ["path", "content"]},
        "read_file": {"required_str": ["path"]},
        "list_dir": {"required_str": ["path"]},
        "run_command": {"required_str": ["command"]},
        "move_file": {"required_str": ["source", "destination"]},
    }

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

            args = span.input_data
            violations: List[str] = []

            # 1. Null byte or binary injection in string arguments
            for k, v in args.items():
                if isinstance(v, str) and "\x00" in v:
                    violations.append(f"Argument '{k}' contains forbidden null byte.")

            # 2. Check schema expectations if tool is known
            # Normalize common synonyms (e.g., 'filepath' -> 'path', 'cmd' -> 'command')
            normalized_args: Dict[str, Any] = {}
            for k, v in args.items():
                key_norm = k.lower()
                if key_norm in ("filepath", "file", "target"):
                    normalized_args["path"] = v
                elif key_norm in ("cmd", "commandline"):
                    normalized_args["command"] = v
                elif key_norm in ("src", "source_path"):
                    normalized_args["source"] = v
                elif key_norm in ("dst", "dest", "destination_path"):
                    normalized_args["destination"] = v
                else:
                    normalized_args[key_norm] = v

            spec = self.SCHEMA_EXPECTATIONS.get(tool_name)
            if spec:
                for req in spec.get("required_str", []):
                    val = normalized_args.get(req)
                    if val is None:
                        violations.append(f"Missing required parameter '{req}' for tool '{tool_name}'.")
                    elif not isinstance(val, str):
                        violations.append(f"Parameter '{req}' must be a string, got {type(val).__name__}.")
                    elif not val.strip():
                        violations.append(f"Parameter '{req}' cannot be an empty string.")

            # Check if metadata or error data flags invalid arguments
            if span.metadata_payload.get("invalid_arguments"):
                violations.append(str(span.metadata_payload.get("invalid_arguments")))

            if violations:
                evidence = [
                    EvidenceItem(
                        event_id=span.id,
                        evidence_type="INVALID_ARGUMENT",
                        description=f"Tool call '{tool_name}' argument violations: {'; '.join(violations)}",
                    )
                ]

                # Check if it resulted in an error result
                result_span = context.find_tool_result_for(span.id)
                if result_span:
                    evidence.append(
                        EvidenceItem(
                            event_id=result_span.id,
                            evidence_type="RESULT_FEEDBACK",
                            description=f"Result status following invalid arguments: '{result_span.status}'.",
                        )
                    )

                findings.append(
                    RawFinding(
                        rule_id=self.rule_id,
                        rule_name=self.name,
                        title=f"Invalid Arguments in Tool Call '{tool_name}'",
                        description=f"Tool call '{tool_name}' violated input schema constraints: {'; '.join(violations)}.",
                        severity=Severity.MEDIUM.value,
                        verification_status=VerificationStatus.CONFIRMED.value,
                        first_suspicious_event_id=span.id,
                        evidence_items=evidence,
                        details={
                            "tool_name": tool_name,
                            "violations": violations,
                            "arguments": {k: str(v) for k, v in args.items() if k not in ("password", "secret")},
                        },
                    )
                )

        return findings
