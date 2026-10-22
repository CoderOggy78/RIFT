import time
import httpx
from typing import Tuple, Dict, Any, Optional
import ollama
from ollama import AsyncClient, ResponseError, RequestError

from app.core.config import settings
from app.services.ai.output_parser import OutputParser, GemmaInvestigationOutput, InvalidOutputError
from app.services.ai.prompt_manager import PromptManager


class OllamaUnavailableError(Exception):
    """Raised when Ollama HTTP daemon is unreachable."""
    pass


class ModelMissingError(Exception):
    """Raised when configured Gemma model is not installed."""
    pass


class InferenceTimeoutError(Exception):
    """Raised when Gemma inference exceeds GEMMA_TIMEOUT_SECONDS."""
    pass


class GemmaClient:
    def __init__(
        self,
        base_url: Optional[str] = None,
        model_name: Optional[str] = None,
        timeout_seconds: Optional[float] = None,
        temperature: Optional[float] = None,
        api_key: Optional[str] = None,
        provider: Optional[str] = None,
    ):
        self.provider = provider or getattr(settings, "RIFT_INFERENCE_PROVIDER", "local")
        self.base_url = (base_url or settings.OLLAMA_BASE_URL).rstrip("/")
        self.model_name = model_name or settings.GEMMA_MODEL
        self.timeout_seconds = timeout_seconds or float(settings.GEMMA_TIMEOUT_SECONDS)
        self.temperature = temperature if temperature is not None else settings.GEMMA_TEMPERATURE
        self.api_key = api_key or getattr(settings, "OLLAMA_API_KEY", "")

    def _get_async_client(self) -> AsyncClient:
        headers = {}
        if self.provider == "cloud" and self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        # Cloud host vs local host
        host = "https://ollama.com" if self.provider == "cloud" else self.base_url

        return AsyncClient(
            host=host,
            timeout=self.timeout_seconds,
            headers=headers if headers else None,
        )

    async def generate_investigation(
        self, evidence_json_str: str
    ) -> Tuple[GemmaInvestigationOutput, str, float]:
        """
        Sends the evidence package to Gemma via Ollama Python SDK,
        requests structured JSON enforcing the schema, and executes
        a bounded single retry if formatting is invalid.
        Returns (parsed_output, raw_text, duration_ms).
        """
        system_prompt = PromptManager.build_system_prompt()
        user_prompt = PromptManager.build_user_prompt(evidence_json_str)

        start_time = time.time()

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        raw_response_text = ""
        try:
            raw_response_text = await self._call_ollama_chat(messages)
            duration_ms = round((time.time() - start_time) * 1000, 2)
            parsed = OutputParser.parse_response(raw_response_text)
            return parsed, raw_response_text, duration_ms

        except InvalidOutputError as parse_err:
            # Bounded corrective retry (1 retry)
            corrective_messages = list(messages)
            corrective_messages.append({"role": "assistant", "content": raw_response_text})
            corrective_messages.append({
                "role": "user",
                "content": (
                    f"Your response could not be parsed: {parse_err.message}. "
                    "Output ONLY the corrected, valid JSON object matching the requested schema. "
                    "Do not include explanation text or markdown fences."
                ),
            })

            try:
                retry_raw_text = await self._call_ollama_chat(corrective_messages)
                duration_ms = round((time.time() - start_time) * 1000, 2)
                parsed = OutputParser.parse_response(retry_raw_text)
                return parsed, retry_raw_text, duration_ms
            except Exception as retry_err:
                duration_ms = round((time.time() - start_time) * 1000, 2)
                raise InvalidOutputError(
                    message=f"Gemma output failed validation even after corrective retry: {str(retry_err)}",
                    raw_output=raw_response_text,
                )

    async def _call_ollama_chat(self, messages: list) -> str:
        """Executes a single non-streaming chat request using official Ollama AsyncClient with structured JSON schema."""
        client = self._get_async_client()

        # Build schema for structured outputs
        schema = GemmaInvestigationOutput.model_json_schema()

        try:
            try:
                # Primary attempt: Enforce structured JSON schema
                chat_res = await client.chat(
                    model=self.model_name,
                    messages=messages,
                    stream=False,
                    format=schema,
                    options={
                        "temperature": self.temperature,
                    },
                )
            except ResponseError as schema_err:
                err_str = str(schema_err).lower()
                # If structured outputs return 501 or are unsupported for this model architecture
                if schema_err.status_code == 501 or "structured output is unavailable" in err_str:
                    try:
                        # Attempt with format='json'
                        chat_res = await client.chat(
                            model=self.model_name,
                            messages=messages,
                            stream=False,
                            format="json",
                            options={
                                "temperature": self.temperature,
                            },
                        )
                    except ResponseError as json_err:
                        if json_err.status_code == 501 or "structured output is unavailable" in str(json_err).lower():
                            # Fallback without format parameter; prompt already includes complete JSON schema
                            chat_res = await client.chat(
                                model=self.model_name,
                                messages=messages,
                                stream=False,
                                options={
                                    "temperature": self.temperature,
                                },
                            )
                        else:
                            raise json_err
                elif "format" in err_str or "schema" in err_str:
                    chat_res = await client.chat(
                        model=self.model_name,
                        messages=messages,
                        stream=False,
                        format="json",
                        options={
                            "temperature": self.temperature,
                        },
                    )
                else:
                    raise schema_err
            except Exception as other_err:
                err_str = str(other_err).lower()
                if "format" in err_str or "schema" in err_str or "501" in err_str:
                    chat_res = await client.chat(
                        model=self.model_name,
                        messages=messages,
                        stream=False,
                        options={
                            "temperature": self.temperature,
                        },
                    )
                else:
                    raise other_err

            message_obj = chat_res.message
            content = (message_obj.content or "").strip()
            return content

        except ResponseError as res_err:
            if res_err.status_code == 404 or "not found" in str(res_err).lower():
                raise ModelMissingError(
                    f"Model '{self.model_name}' was not found on Ollama server at {self.base_url}."
                )
            raise InvalidOutputError(
                message=f"Ollama returned HTTP error {res_err.status_code}: {res_err.error}",
                raw_output=str(res_err),
            )
        except (httpx.ConnectError, RequestError, ConnectionRefusedError) as conn_err:
            raise OllamaUnavailableError(
                f"Could not connect to Ollama server at {self.base_url}. Ensure it is running (`ollama serve`)."
            )
        except (httpx.TimeoutException, TimeoutError):
            raise InferenceTimeoutError(
                f"Gemma inference timed out after {self.timeout_seconds} seconds."
            )
