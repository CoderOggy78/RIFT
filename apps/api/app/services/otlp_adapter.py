"""
OpenTelemetry (OTLP) to RIFT Trace Adapter.

Translates standard OpenTelemetry JSON trace exports (resourceSpans, scopeSpans, spans)
into native RIFT execution trace models (project, agent, trace, spans).
Preserves trace IDs, span IDs, parent-child hierarchies, timestamps,
all attribute types (string, int, bool, double, array, kvlist), and execution statuses.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple


def extract_otlp_value(val: Any) -> Any:
    """
    Extracts native Python value from OpenTelemetry AnyValue representation.
    Supports stringValue, intValue, boolValue, doubleValue, bytesValue,
    arrayValue, and kvlistValue.
    """
    if val is None or not isinstance(val, dict):
        return val

    if "stringValue" in val:
        return val["stringValue"]

    if "intValue" in val:
        raw_int = val["intValue"]
        try:
            return int(raw_int)
        except (ValueError, TypeError):
            return raw_int

    if "boolValue" in val:
        return bool(val["boolValue"])

    if "doubleValue" in val:
        raw_double = val["doubleValue"]
        try:
            return float(raw_double)
        except (ValueError, TypeError):
            return raw_double

    if "bytesValue" in val:
        return val["bytesValue"]

    if "arrayValue" in val:
        items = val["arrayValue"].get("values", [])
        return [extract_otlp_value(item) for item in items]

    if "kvlistValue" in val:
        items = val["kvlistValue"].get("values", [])
        res: Dict[str, Any] = {}
        for item in items:
            if isinstance(item, dict) and "key" in item:
                res[item["key"]] = extract_otlp_value(item.get("value"))
        return res

    # If it's already a regular dictionary with no OTLP value wrapper
    return {k: extract_otlp_value(v) for k, v in val.items()}


def parse_otlp_attributes(attrs: Any) -> Dict[str, Any]:
    """
    Normalizes a list of OTLP KeyValue objects or a flat dictionary into a clean dict.
    """
    result: Dict[str, Any] = {}
    if isinstance(attrs, list):
        for item in attrs:
            if isinstance(item, dict) and "key" in item:
                result[item["key"]] = extract_otlp_value(item.get("value"))
    elif isinstance(attrs, dict):
        for k, v in attrs.items():
            result[k] = extract_otlp_value(v)
    return result


def parse_unix_nano_to_datetime(val: Any) -> datetime:
    """
    Safely parses a Unix nanosecond timestamp (int or numeric string) or ISO string into UTC datetime.
    """
    if not val:
        return datetime.now(timezone.utc)

    if isinstance(val, (int, float)):
        if val > 1e16:
            # Nanoseconds
            return datetime.fromtimestamp(val / 1e9, tz=timezone.utc)
        elif val > 1e12:
            # Milliseconds
            return datetime.fromtimestamp(val / 1e3, tz=timezone.utc)
        elif val > 1e9:
            # Seconds
            return datetime.fromtimestamp(val, tz=timezone.utc)
        else:
            return datetime.fromtimestamp(val, tz=timezone.utc)

    if isinstance(val, str):
        val = val.strip()
        try:
            num = float(val)
            if num > 1e16:
                return datetime.fromtimestamp(num / 1e9, tz=timezone.utc)
            elif num > 1e12:
                return datetime.fromtimestamp(num / 1e3, tz=timezone.utc)
            else:
                return datetime.fromtimestamp(num, tz=timezone.utc)
        except ValueError:
            pass

        # Try ISO format
        try:
            return datetime.fromisoformat(val.replace("Z", "+00:00"))
        except ValueError:
            pass

    return datetime.now(timezone.utc)


def is_otlp_payload(data: Any) -> bool:
    """Checks if a payload is formatted according to OpenTelemetry JSON schema."""
    if not isinstance(data, dict):
        return False
    return "resourceSpans" in data or "scopeSpans" in data


def infer_event_type(name: str, attrs: Dict[str, Any]) -> str:
    """
    Infers RIFT event_type (user_prompt, agent_plan, model_call, tool_call, tool_result, validation, error)
    from OpenTelemetry span name and attributes.
    """
    name_lower = (name or "").lower()

    if "event_type" in attrs:
        return str(attrs["event_type"])

    # Validation events
    if "validation" in name_lower or attrs.get("tool.operation") == "test" or attrs.get("tool.name") == "test-runner":
        return "validation"

    # Tool calls
    if name_lower.startswith("tool.") or "tool.name" in attrs or "tool.operation" in attrs:
        return "tool_call"

    # Agent planning
    if "plan" in name_lower or attrs.get("agent.action") == "plan":
        return "agent_plan"

    # User prompt
    if "user" in name_lower or "prompt" in name_lower or "instruction" in name_lower:
        return "user_prompt"

    # Model call
    if "model" in name_lower or "llm" in name_lower or name_lower.startswith("openai.") or name_lower.startswith("anthropic."):
        return "model_call"

    # Agent response / action
    if "response" in name_lower or name_lower.startswith("agent."):
        return "agent_plan"

    if "error" in name_lower:
        return "error"

    return "tool_call" if "tool" in name_lower else "agent_plan"


def otlp_to_rift_payload(data: Dict[str, Any], default_objective: Optional[str] = None) -> Dict[str, Any]:
    """
    Transforms an OpenTelemetry trace export (resourceSpans/scopeSpans/spans)
    into a native RIFT TraceImportPayload dictionary.
    """
    resource_attrs: Dict[str, Any] = {}
    raw_spans: List[Dict[str, Any]] = []

    # 1. Collect resource attributes and spans
    resource_spans = data.get("resourceSpans", [])
    if not resource_spans and "scopeSpans" in data:
        resource_spans = [{"scopeSpans": data["scopeSpans"]}]

    for r_span in resource_spans:
        res = r_span.get("resource", {})
        if "attributes" in res:
            resource_attrs.update(parse_otlp_attributes(res["attributes"]))

        for s_span in r_span.get("scopeSpans", []):
            scope_info = s_span.get("scope", {})
            for span in s_span.get("spans", []):
                span["_scope"] = scope_info
                raw_spans.append(span)

    if not raw_spans:
        raise ValueError("No spans found in OpenTelemetry trace payload (resourceSpans is empty).")

    # 2. Extract Trace ID and attributes from spans
    primary_trace_id = raw_spans[0].get("traceId") or raw_spans[0].get("trace_id") or "otel-trace"

    # Aggregate attributes across spans to discover agent and trace details
    all_span_attrs: List[Dict[str, Any]] = []
    for s in raw_spans:
        s_attrs = parse_otlp_attributes(s.get("attributes", []))
        all_span_attrs.append(s_attrs)

    # Determine Project Name
    project_name = (
        resource_attrs.get("service.name")
        or resource_attrs.get("service_name")
        or all_span_attrs[0].get("service.name")
        or "OpenTelemetry Agent Service"
    )
    project_id = f"proj-{project_name.lower().replace(' ', '-')}"

    # Determine Agent Name and Framework
    agent_name = "Autonomous Agent"
    agent_framework = "OpenTelemetry / Agent API"
    for attrs in all_span_attrs:
        if "agent.name" in attrs:
            agent_name = str(attrs["agent.name"])
            break
        if "service.name" in attrs and agent_name == "Autonomous Agent":
            agent_name = str(attrs["service.name"])

    for s in raw_spans:
        scope = s.get("_scope", {})
        if scope.get("name"):
            agent_framework = f"{scope.get('name')} v{scope.get('version', '1.0.0')}"
            break

    # Determine Objective
    objective = default_objective
    if not objective:
        for attrs in all_span_attrs:
            if "agent.task" in attrs:
                objective = str(attrs["agent.task"])
                break
            if "agent.instruction" in attrs:
                objective = str(attrs["agent.instruction"])
                break
            if "task" in attrs:
                objective = str(attrs["task"])
                break

    if not objective:
        objective = f"Execution trace ({raw_spans[0].get('name', 'agent.run')})"

    # 3. Process Spans
    normalized_spans: List[Dict[str, Any]] = []
    span_id_set = {s.get("spanId") or s.get("id") for s in raw_spans if s.get("spanId") or s.get("id")}
    trace_has_error = False

    min_start: Optional[datetime] = None
    max_end: Optional[datetime] = None

    for idx, s in enumerate(raw_spans):
        span_id = s.get("spanId") or s.get("id") or f"span-{idx + 1}"
        parent_id = s.get("parentSpanId") or s.get("parent_span_id") or None
        if parent_id == "" or parent_id == span_id:
            parent_id = None
        # If parent_id refers to an external span not in this trace, set to None for DAG integrity
        if parent_id and parent_id not in span_id_set:
            parent_id = None

        name = s.get("name") or f"operation_{idx + 1}"
        attrs = all_span_attrs[idx]

        # Timestamps and duration
        start_time = parse_unix_nano_to_datetime(s.get("startTimeUnixNano") or s.get("start_time"))
        end_time = parse_unix_nano_to_datetime(s.get("endTimeUnixNano") or s.get("end_time"))

        if min_start is None or start_time < min_start:
            min_start = start_time
        if max_end is None or end_time > max_end:
            max_end = end_time

        duration_ms = 0.0
        if "startTimeUnixNano" in s and "endTimeUnixNano" in s:
            try:
                duration_ms = max(0.0, (float(s["endTimeUnixNano"]) - float(s["startTimeUnixNano"])) / 1e6)
            except (ValueError, TypeError):
                duration_ms = (end_time - start_time).total_seconds() * 1000.0
        else:
            duration_ms = max(0.0, (end_time - start_time).total_seconds() * 1000.0)

        # Status
        status_obj = s.get("status", {})
        code = status_obj.get("code")
        # In OTel: 0=UNSET, 1=OK, 2=ERROR
        is_error = (
            code == 2
            or str(code).upper() == "STATUS_CODE_ERROR"
            or attrs.get("test.exit_code", 0) != 0
            or attrs.get("exit_code", 0) != 0
            or "test.failure" in attrs
            or "error" in attrs
        )
        span_status = "error" if is_error else "success"
        if is_error:
            trace_has_error = True

        event_type = infer_event_type(name, attrs)

        # Partition structured data
        input_data: Dict[str, Any] = {}
        output_data: Dict[str, Any] = {}
        error_data: Dict[str, Any] = {}
        metadata: Dict[str, Any] = dict(attrs)

        # Include resource attributes in metadata
        metadata["resource"] = resource_attrs

        # Map tool inputs
        if "file.path" in attrs:
            input_data["path"] = attrs["file.path"]
            input_data["file"] = attrs["file.path"]
            input_data["target"] = attrs["file.path"]

        if "file.operation" in attrs:
            input_data["operation"] = attrs["file.operation"]

        if "tool.name" in attrs:
            t_op = attrs.get("tool.operation", "")
            if t_op == "delete":
                input_data["tool"] = "delete_file"
            elif t_op == "list":
                input_data["tool"] = "list_directory"
            else:
                input_data["tool"] = f"{attrs['tool.name']}.{t_op}" if t_op else attrs["tool.name"]

        if "test.command" in attrs:
            input_data["command"] = attrs["test.command"]
            input_data["test_command"] = attrs["test.command"]

        # Map outputs
        if "agent.output" in attrs:
            output_data["output"] = attrs["agent.output"]
            output_data["agent_response"] = attrs["agent.output"]
            output_data["summary"] = attrs["agent.output"]

        if "agent.claimed_success" in attrs:
            output_data["claimed_success"] = attrs["agent.claimed_success"]

        if "test.exit_code" in attrs:
            output_data["exit_code"] = int(attrs["test.exit_code"])

        if "test.failure" in attrs:
            output_data["failure"] = attrs["test.failure"]
            error_data["error"] = attrs["test.failure"]

        if is_error and not error_data:
            err_msg = status_obj.get("message") or attrs.get("error.message") or "Span completed with error status"
            error_data["error"] = err_msg

        normalized_spans.append({
            "id": span_id,
            "parent_span_id": parent_id,
            "event_type": event_type,
            "name": name,
            "timestamp": start_time,
            "duration_ms": duration_ms,
            "status": span_status,
            "input_data": input_data,
            "output_data": output_data,
            "error_data": error_data,
            "metadata": metadata,
        })

    trace_status = "error" if trace_has_error else "success"

    return {
        "project": {
            "id": project_id,
            "name": project_name,
            "description": resource_attrs.get("deployment.environment", "OpenTelemetry ingested agent trace"),
        },
        "agent": {
            "id": f"agent-{agent_name.lower().replace(' ', '-')}",
            "name": agent_name,
            "framework": agent_framework,
        },
        "trace": {
            "id": primary_trace_id,
            "objective": objective,
            "status": trace_status,
            "started_at": min_start or datetime.now(timezone.utc),
            "ended_at": max_end or datetime.now(timezone.utc),
        },
        "spans": normalized_spans,
    }
