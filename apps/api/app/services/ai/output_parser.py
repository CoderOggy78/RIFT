import json
import re
from typing import List, Optional, Literal, Union, Dict, Any
from pydantic import BaseModel, Field, ValidationError, field_validator


class HypothesisOutputItem(BaseModel):
    title: str = Field(..., min_length=3, description="Short title of the failure hypothesis")
    explanation: str = Field(..., min_length=10, description="Causal explanation grounded in trace events")
    confidence: Literal["high", "medium", "low"] = Field(default="medium")
    supporting_event_ids: List[str] = Field(default_factory=list)
    contradicting_event_ids: List[str] = Field(default_factory=list)
    missing_evidence: List[str] = Field(default_factory=list)
    suggested_verification: Optional[str] = Field(default=None)
    code_citations: List[Dict[str, Any]] = Field(default_factory=list)

    @field_validator("missing_evidence", "supporting_event_ids", "contradicting_event_ids", "code_citations", mode="before")
    @classmethod
    def normalize_list_fields(cls, v):
        if isinstance(v, str):
            v_str = v.strip()
            return [v_str] if v_str else []
        if v is None:
            return []
        return v


class RemediationOutputItem(BaseModel):
    action: str = Field(..., min_length=5, description="Specific architectural or code guardrail to implement")
    rationale: str = Field(..., min_length=5, description="Why this guardrail prevents recurrence")
    risk: Literal["low", "medium", "high"] = Field(default="low")
    requires_human_approval: bool = Field(default=True)
    verification_method: Optional[str] = Field(default=None)

    @field_validator("risk", mode="before")
    @classmethod
    def normalize_risk(cls, v):
        if isinstance(v, str):
            v_lower = v.lower().strip()
            if v_lower in ("low", "medium", "high"):
                return v_lower
        return "low"


class GemmaInvestigationOutput(BaseModel):
    summary: str = Field(..., min_length=10, description="High-level technical incident summary")
    observed_failure: str = Field(..., min_length=5, description="Specific observed error or violation")
    first_suspicious_event_id: Optional[str] = Field(default=None)
    hypotheses: List[HypothesisOutputItem] = Field(default_factory=list)
    remediation: List[RemediationOutputItem] = Field(default_factory=list)
    investigation_status: Literal["conclusive", "partially_conclusive", "inconclusive"] = Field(
        default="conclusive"
    )

    @field_validator("investigation_status", mode="before")
    @classmethod
    def normalize_status(cls, v):
        if isinstance(v, str):
            v_lower = v.lower().strip()
            if v_lower in ("conclusive", "partially_conclusive", "inconclusive"):
                return v_lower
        return "conclusive"


class InvalidOutputError(Exception):
    """Raised when Gemma output cannot be parsed or validated against the schema."""
    def __init__(self, message: str, raw_output: str, validation_errors: Optional[List[str]] = None):
        super().__init__(message)
        self.message = message
        self.raw_output = raw_output
        self.validation_errors = validation_errors or []


class OutputParser:
    @staticmethod
    def extract_json(raw_text: str) -> str:
        """Extracts the outermost JSON object string from raw model text."""
        if not raw_text:
            return ""

        text = raw_text.strip()

        # Handle markdown fences ```json ... ```
        fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
        if fence_match:
            text = fence_match.group(1).strip()

        # If not cleanly fenced, extract from first { to last }
        if not (text.startswith("{") and text.endswith("}")):
            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end != -1 and end > start:
                text = text[start : end + 1]

        return text

    @classmethod
    def parse_response(cls, raw_text: str) -> GemmaInvestigationOutput:
        """
        Parses and validates the raw LLM output into a typed GemmaInvestigationOutput.
        Raises InvalidOutputError on JSON parsing or Pydantic validation failure.
        """
        json_str = cls.extract_json(raw_text)

        if not json_str:
            raise InvalidOutputError(
                message="No JSON object found in model output.",
                raw_output=raw_text
            )

        try:
            parsed_dict = json.loads(json_str)
        except json.JSONDecodeError as err:
            raise InvalidOutputError(
                message=f"Model output contains malformed JSON: {err.msg} at line {err.lineno} col {err.colno}",
                raw_output=raw_text
            )

        if not isinstance(parsed_dict, dict):
            raise InvalidOutputError(
                message="Parsed JSON is not a top-level JSON object.",
                raw_output=raw_text
            )

        try:
            return GemmaInvestigationOutput.model_validate(parsed_dict)
        except ValidationError as val_err:
            error_details = [f"{err['loc']}: {err['msg']}" for err in val_err.errors()]
            raise InvalidOutputError(
                message=f"Output schema validation failed with {len(error_details)} error(s).",
                raw_output=raw_text,
                validation_errors=error_details
            )

    parse_and_validate = parse_response
