import time
import platform
import shutil
import subprocess
import httpx
from typing import Dict, Any, List, Optional
from app.core.config import settings
from app.services.ai.model_registry import ModelRegistry


class ModelHealthService:
    @staticmethod
    def get_hardware_info() -> Dict[str, Any]:
        """Inspects physical Mac hardware specifications."""
        mac_ver = platform.mac_ver()[0] if hasattr(platform, "mac_ver") else platform.release()
        info: Dict[str, Any] = {
            "os": platform.system(),
            "os_version": mac_ver or platform.release(),
            "arch": platform.machine(),
            "chip": "Apple Silicon",
            "memory_total_gb": 16.0,
            "is_apple_silicon": platform.machine() in ("arm64", "aarch64"),
            "disk_free_gb": None,
        }

        try:
            _, _, free = shutil.disk_usage("/")
            info["disk_free_gb"] = round(free / (1024**3), 1)
        except Exception:
            pass

        try:
            res = subprocess.run(
                ["sysctl", "-n", "machdep.cpu.brand_string"],
                capture_output=True,
                text=True,
                timeout=1.5,
            )
            if res.returncode == 0 and res.stdout.strip():
                info["chip"] = res.stdout.strip()
        except Exception:
            pass

        try:
            res = subprocess.run(
                ["sysctl", "-n", "hw.memsize"],
                capture_output=True,
                text=True,
                timeout=1.5,
            )
            if res.returncode == 0 and res.stdout.strip():
                bytes_mem = int(res.stdout.strip())
                info["memory_total_gb"] = round(bytes_mem / (1024**3), 1)
        except Exception:
            pass

        return info

    @staticmethod
    async def get_health_status() -> Dict[str, Any]:
        """
        Inspects Ollama reachability and configured Gemma model availability.
        Does not perform automatic downloads.
        """
        configured_model = (settings.GEMMA_MODEL or "").strip()
        base_url = (settings.OLLAMA_BASE_URL or "").rstrip("/")
        provider = getattr(settings, "RIFT_INFERENCE_PROVIDER", "local")
        hardware_info = ModelHealthService.get_hardware_info()

        # Check 1: Base URL configured
        if not base_url:
            return {
                "status": "not_configured",
                "configured_model": configured_model,
                "available_models": [],
                "ollama_base_url": "",
                "provider": provider,
                "ollama_version": None,
                "hardware_info": hardware_info,
                "message": "Ollama base URL is not configured.",
                "setup_instructions": "Set OLLAMA_BASE_URL=http://localhost:11434 in your .env file.",
            }

        # Check 2: Configured model belongs to Gemma family
        if configured_model and not ModelRegistry.is_gemma_family(configured_model):
            return {
                "status": "not_configured",
                "configured_model": configured_model,
                "available_models": [],
                "ollama_base_url": base_url,
                "provider": provider,
                "ollama_version": None,
                "hardware_info": hardware_info,
                "message": f"Configured model '{configured_model}' is not a Google Gemma model. RIFT requires Gemma.",
                "setup_instructions": "Configure GEMMA_MODEL=gemma4:e2b in your .env file.",
            }

        # Check 3: Ollama server reachability and version
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                # Check version
                ollama_version = None
                try:
                    v_res = await client.get(f"{base_url}/api/version")
                    if v_res.status_code == 200:
                        ollama_version = v_res.json().get("version")
                except Exception:
                    pass

                # Check tags
                res = await client.get(f"{base_url}/api/tags")

                if res.status_code != 200:
                    return {
                        "status": "ollama_unavailable",
                        "configured_model": configured_model,
                        "available_models": [],
                        "ollama_base_url": base_url,
                        "provider": provider,
                        "ollama_version": ollama_version,
                        "hardware_info": hardware_info,
                        "message": f"Ollama returned HTTP status {res.status_code}.",
                        "setup_instructions": "Check Ollama server logs: `ollama serve`.",
                    }

                data = res.json()
                raw_models = data.get("models", [])
                available_models = [m.get("name", "") for m in raw_models if "name" in m]

                # Check 4: Is a model configured?
                if not configured_model:
                    return {
                        "status": "not_configured",
                        "configured_model": "",
                        "available_models": available_models,
                        "ollama_base_url": base_url,
                        "provider": provider,
                        "ollama_version": ollama_version,
                        "hardware_info": hardware_info,
                        "message": "Ollama is running, but GEMMA_MODEL is not set.",
                        "setup_instructions": "Set GEMMA_MODEL=gemma4:e2b in .env.",
                    }

                # Check 5: Is configured model installed?
                model_matched = any(
                    m == configured_model
                    or m.startswith(f"{configured_model}:")
                    or configured_model.startswith(f"{m}:")
                    for m in available_models
                )

                if model_matched:
                    spec = ModelRegistry.get_model_spec(configured_model)
                    return {
                        "status": "ready",
                        "configured_model": configured_model,
                        "available_models": available_models,
                        "ollama_base_url": base_url,
                        "provider": provider,
                        "ollama_version": ollama_version,
                        "hardware_info": hardware_info,
                        "message": f"Connected to Ollama with '{configured_model}' ready for investigation inference.",
                        "model_spec": {
                            "display_name": spec.display_name if spec else configured_model,
                            "parameter_size": spec.parameter_size if spec else "Unknown",
                            "recommended_context_tokens": spec.recommended_context_tokens if spec else 8192,
                        },
                    }
                else:
                    return {
                        "status": "model_missing",
                        "configured_model": configured_model,
                        "available_models": available_models,
                        "ollama_base_url": base_url,
                        "provider": provider,
                        "ollama_version": ollama_version,
                        "hardware_info": hardware_info,
                        "message": f"Ollama is connected, but configured model '{configured_model}' is not pulled.",
                        "setup_instructions": f"Run `ollama pull {configured_model}` in your terminal to install the model.",
                    }

        except (httpx.ConnectError, httpx.TimeoutException, Exception) as err:
            return {
                "status": "ollama_unavailable",
                "configured_model": configured_model,
                "available_models": [],
                "ollama_base_url": base_url,
                "provider": provider,
                "ollama_version": None,
                "hardware_info": hardware_info,
                "message": f"Cannot reach Ollama at {base_url}. Ensure Ollama is installed and running.",
                "setup_instructions": "1. Ensure Ollama service is running (`brew services start ollama` or `ollama serve`).\n2. Pull Gemma 4: `ollama pull gemma4:e2b`",
            }

    @staticmethod
    async def test_inference(test_prompt: str = "Explain in one sentence why deleting a source configuration file during temporary-file cleanup is unsafe.") -> Dict[str, Any]:
        """
        Executes an actual minimal test inference against the configured Gemma model.
        Returns roundtrip latency and response or detailed error.
        """
        configured_model = (settings.GEMMA_MODEL or "").strip()
        base_url = (settings.OLLAMA_BASE_URL or "").rstrip("/")

        health = await ModelHealthService.get_health_status()
        if health.get("status") != "ready":
            return {
                "success": False,
                "status": health.get("status"),
                "message": health.get("message"),
                "setup_instructions": health.get("setup_instructions"),
                "duration_ms": None,
            }

        start_time = time.time()
        try:
            async with httpx.AsyncClient(timeout=float(settings.GEMMA_TIMEOUT_SECONDS)) as client:
                res = await client.post(
                    f"{base_url}/api/generate",
                    json={
                        "model": configured_model,
                        "prompt": test_prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.1,
                            "num_predict": 100,
                        },
                    },
                )
                duration_ms = round((time.time() - start_time) * 1000, 2)

                if res.status_code == 200:
                    data = res.json()
                    response_text = data.get("response", "").strip()
                    return {
                        "success": True,
                        "status": "ready",
                        "model_name": configured_model,
                        "response_snippet": response_text,
                        "duration_ms": duration_ms,
                        "message": f"Inference test succeeded in {duration_ms}ms.",
                    }
                else:
                    return {
                        "success": False,
                        "status": "invalid_output",
                        "duration_ms": duration_ms,
                        "message": f"Ollama returned HTTP error {res.status_code}: {res.text}",
                    }

        except httpx.TimeoutException:
            duration_ms = round((time.time() - start_time) * 1000, 2)
            return {
                "success": False,
                "status": "inference_timed_out",
                "duration_ms": duration_ms,
                "message": f"Inference test timed out after {settings.GEMMA_TIMEOUT_SECONDS}s.",
            }
        except Exception as err:
            duration_ms = round((time.time() - start_time) * 1000, 2)
            return {
                "success": False,
                "status": "ollama_unavailable",
                "duration_ms": duration_ms,
                "message": f"Inference test failed: {str(err)}",
            }
