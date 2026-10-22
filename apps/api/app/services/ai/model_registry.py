"""
Gemma model registry, capability definitions, and compatibility verification.
Only Gemma family models are permitted.
"""
from typing import Dict, Any, Optional, List


class GemmaModelSpec:
    def __init__(
        self,
        tag: str,
        display_name: str,
        parameter_size: str,
        recommended_context_tokens: int,
        description: str,
    ):
        self.tag = tag
        self.display_name = display_name
        self.parameter_size = parameter_size
        self.recommended_context_tokens = recommended_context_tokens
        self.description = description


SUPPORTED_GEMMA_MODELS: Dict[str, GemmaModelSpec] = {
    "gemma4:e2b": GemmaModelSpec(
        tag="gemma4:e2b",
        display_name="Gemma 4 (E2B)",
        parameter_size="Effective 2B",
        recommended_context_tokens=8192,
        description="Default local model. Highly efficient edge reasoning optimized for 16 GB Apple Silicon Macs.",
    ),
    "gemma4:e4b": GemmaModelSpec(
        tag="gemma4:e4b",
        display_name="Gemma 4 (E4B)",
        parameter_size="Effective 4B",
        recommended_context_tokens=8192,
        description="Optional higher-capability local model for deep root-cause hypothesis generation.",
    ),
    "gemma2:9b": GemmaModelSpec(
        tag="gemma2:9b",
        display_name="Gemma 2 (9B)",
        parameter_size="9.2B",
        recommended_context_tokens=8192,
        description="Standard 9B model. Excellent technical reasoning and JSON adherence.",
    ),
    "gemma2:2b": GemmaModelSpec(
        tag="gemma2:2b",
        display_name="Gemma 2 (2B)",
        parameter_size="2.6B",
        recommended_context_tokens=8192,
        description="Lightweight local model with fast inference on CPU and limited VRAM.",
    ),
    "gemma2:27b": GemmaModelSpec(
        tag="gemma2:27b",
        display_name="Gemma 2 (27B)",
        parameter_size="27B",
        recommended_context_tokens=8192,
        description="High-precision reasoning for complex multi-agent system failures.",
    ),
    "gemma:7b": GemmaModelSpec(
        tag="gemma:7b",
        display_name="Gemma 1 (7B)",
        parameter_size="7B",
        recommended_context_tokens=8192,
        description="Gemma version 1 7B release.",
    ),
    "gemma:2b": GemmaModelSpec(
        tag="gemma:2b",
        display_name="Gemma 1 (2B)",
        parameter_size="2B",
        recommended_context_tokens=8192,
        description="Gemma version 1 2B release.",
    ),
}


class ModelRegistry:
    @staticmethod
    def is_gemma_family(model_name: str) -> bool:
        """Verifies that the model strictly belongs to Google Gemma family."""
        if not model_name:
            return False
        clean = model_name.strip().lower()
        return "gemma" in clean

    @staticmethod
    def get_model_spec(model_name: str) -> Optional[GemmaModelSpec]:
        """Returns the model spec if known, or creates generic Gemma spec."""
        if not ModelRegistry.is_gemma_family(model_name):
            return None

        clean = model_name.strip().lower()
        for tag, spec in SUPPORTED_GEMMA_MODELS.items():
            if clean == tag or clean.startswith(f"{tag}:") or tag.startswith(f"{clean}:"):
                return spec

        # Fallback for custom gemma tags e.g. gemma2:9b-instruct-q4_K_M
        return GemmaModelSpec(
            tag=model_name,
            display_name=f"Custom ({model_name})",
            parameter_size="Unknown",
            recommended_context_tokens=8192,
            description="Custom local Gemma model tag.",
        )

    @staticmethod
    def list_supported_models() -> List[Dict[str, Any]]:
        return [
            {
                "tag": spec.tag,
                "display_name": spec.display_name,
                "parameter_size": spec.parameter_size,
                "recommended_context_tokens": spec.recommended_context_tokens,
                "description": spec.description,
            }
            for spec in SUPPORTED_GEMMA_MODELS.values()
        ]
