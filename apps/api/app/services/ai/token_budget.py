"""
Conservative token budgeting and truncation utilities.
Uses character-heuristic estimation (~3.5 characters/token for JSON/code)
as local Gemma weights are hosted in Ollama and direct local tokenizers may not be bundled.
"""
from typing import Dict, Any


class TokenBudgetManager:
    CHARS_PER_TOKEN = 3.5  # Conservative ratio for code and structured JSON

    def __init__(self, max_context_tokens: int = 8192, output_reserve_tokens: int = 2048):
        self.max_context_tokens = max_context_tokens
        self.output_reserve_tokens = output_reserve_tokens
        # Reserve for system instructions and schema definitions
        self.system_prompt_reserve = 1200
        self.evidence_budget_tokens = max(
            1000,
            self.max_context_tokens - self.output_reserve_tokens - self.system_prompt_reserve
        )
        self.evidence_budget_chars = int(self.evidence_budget_tokens * self.CHARS_PER_TOKEN)

    def estimate_tokens(self, text: str) -> int:
        if not text:
            return 0
        return int(len(text) / self.CHARS_PER_TOKEN) + 1

    def truncate_string(self, text: str, max_chars: int = 800) -> str:
        if not text or len(text) <= max_chars:
            return text
        omitted = len(text) - max_chars
        return f"{text[:max_chars]}... [TRUNCATED {omitted} characters]"

    def truncate_field_value(self, val: Any, max_chars: int = 600) -> Any:
        if isinstance(val, str):
            return self.truncate_string(val, max_chars)
        elif isinstance(val, dict):
            return {k: self.truncate_field_value(v, max_chars) for k, v in val.items()}
        elif isinstance(val, list):
            if len(val) > 20:
                truncated_list = [self.truncate_field_value(x, max_chars) for x in val[:20]]
                truncated_list.append(f"... [{len(val) - 20} items omitted]")
                return truncated_list
            return [self.truncate_field_value(x, max_chars) for x in val]
        return val
