from typing import List, Dict, Optional, Set
from app.models.models import Trace, Span
from app.services.detection.policies import DetectionPolicy, default_policy


class TraceContext:
    def __init__(self, trace: Trace, spans: List[Span], policy: Optional[DetectionPolicy] = None):
        self.trace = trace
        self.spans = sorted(spans, key=lambda s: s.timestamp)
        self.policy = policy or default_policy

        # Indexes for fast deterministic lookup
        self.spans_by_id: Dict[str, Span] = {s.id: s for s in self.spans}
        self.spans_by_type: Dict[str, List[Span]] = {}
        self.parent_to_children: Dict[str, List[Span]] = {}

        for span in self.spans:
            # Group by event_type
            etype = (span.event_type or "").lower()
            if etype not in self.spans_by_type:
                self.spans_by_type[etype] = []
            self.spans_by_type[etype].append(span)

            # Map hierarchy
            if span.parent_span_id:
                if span.parent_span_id not in self.parent_to_children:
                    self.parent_to_children[span.parent_span_id] = []
                self.parent_to_children[span.parent_span_id].append(span)

        # Pair tool_calls to tool_results
        self.tool_call_to_result: Dict[str, Optional[Span]] = {}
        tool_results = self.spans_by_type.get("tool_result", [])
        for tool_call in self.spans_by_type.get("tool_call", []):
            # 1. Match by parent_span_id
            matched_result = None
            for tr in tool_results:
                if tr.parent_span_id == tool_call.id:
                    matched_result = tr
                    break

            # 2. If not parented directly, find the next immediate tool_result in time
            if not matched_result:
                call_time = tool_call.timestamp
                for tr in tool_results:
                    if tr.timestamp >= call_time and (tr.timestamp - call_time).total_seconds() < 60:
                        matched_result = tr
                        break

            self.tool_call_to_result[tool_call.id] = matched_result

    def find_tool_result_for(self, tool_call_id: str) -> Optional[Span]:
        """Retrieve corresponding tool_result span for a tool_call."""
        return self.tool_call_to_result.get(tool_call_id)

    def get_children(self, span_id: str) -> List[Span]:
        return self.parent_to_children.get(span_id, [])

    def get_ancestors(self, span_id: str) -> List[Span]:
        ancestors = []
        curr = self.spans_by_id.get(span_id)
        visited = set()
        while curr and curr.parent_span_id and curr.parent_span_id not in visited:
            visited.add(curr.parent_span_id)
            parent = self.spans_by_id.get(curr.parent_span_id)
            if parent:
                ancestors.append(parent)
                curr = parent
            else:
                break
        return ancestors

    def is_destructive_call(self, span: Span) -> bool:
        if (span.event_type or "").lower() != "tool_call":
            return False
        tool_name = (
            span.input_data.get("tool")
            or span.input_data.get("name")
            or span.name.replace("tool:", "")
        ).lower()
        return tool_name in self.policy.deletion_tools or span.metadata_payload.get("is_destructive") is True
