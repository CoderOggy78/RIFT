import httpx
from typing import List, Dict, Any
from app.core.config import settings
from app.schemas.schemas import ModelStatusResponse


class OllamaService:
    @staticmethod
    async def check_status() -> ModelStatusResponse:
        """
        Lightweight non-blocking health and model availability check for Ollama.
        Does not execute inference or initiate automatic downloads.
        """
        configured_model = (settings.GEMMA_MODEL or "").strip()
        base_url = (settings.OLLAMA_BASE_URL or "").rstrip("/")

        if not base_url:
            return ModelStatusResponse(
                status="not_configured",
                configured_model=configured_model,
                available_models=[],
                ollama_base_url="",
                message="Ollama base URL is not configured.",
            )

        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                res = await client.get(f"{base_url}/api/tags")
                if res.status_code == 200:
                    data = res.json()
                    models_raw = data.get("models", [])
                    available_models = [m.get("name", "") for m in models_raw if "name" in m]

                    if not configured_model:
                        return ModelStatusResponse(
                            status="not_configured",
                            configured_model="",
                            available_models=available_models,
                            ollama_base_url=base_url,
                            message="Ollama is connected, but no Gemma model is configured in GEMMA_MODEL.",
                        )

                    # Check if configured model or tagged version matches
                    # e.g., 'gemma2:9b' or 'gemma2:9b-instruct' or 'gemma2'
                    model_matched = any(
                        m == configured_model or m.startswith(f"{configured_model}:") or configured_model.startswith(f"{m}:")
                        for m in available_models
                    )

                    if model_matched:
                        return ModelStatusResponse(
                            status="connected",
                            configured_model=configured_model,
                            available_models=available_models,
                            ollama_base_url=base_url,
                            message=f"Connected to Ollama with '{configured_model}' ready for local inference.",
                        )
                    else:
                        return ModelStatusResponse(
                            status="model_missing",
                            configured_model=configured_model,
                            available_models=available_models,
                            ollama_base_url=base_url,
                            message=f"Ollama is running, but configured model '{configured_model}' was not found in installed tags.",
                        )
                else:
                    return ModelStatusResponse(
                        status="ollama_unavailable",
                        configured_model=configured_model,
                        available_models=[],
                        ollama_base_url=base_url,
                        message=f"Ollama returned HTTP status {res.status_code}.",
                    )
        except (httpx.ConnectError, httpx.TimeoutException, Exception) as e:
            return ModelStatusResponse(
                status="ollama_unavailable",
                configured_model=configured_model,
                available_models=[],
                ollama_base_url=base_url,
                message=f"Cannot reach Ollama at {base_url}. Ensure Ollama is running (`ollama serve`).",
            )
