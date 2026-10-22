import os
import json
from typing import List, Union, Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


from pathlib import Path

_DETECTED_REPO_ROOT = (
    "/Users/oggy/RIFT"
    if os.path.exists("/Users/oggy/RIFT")
    else str(Path(__file__).resolve().parents[4])
)


def _get_default_database_url() -> str:
    if os.environ.get("VERCEL"):
        return "sqlite:////tmp/rift.db"
    if os.path.exists("/Users/oggy/RIFT/rift.db"):
        return "sqlite:////Users/oggy/RIFT/rift.db"
    return f"sqlite:///{_DETECTED_REPO_ROOT}/rift.db"


class Settings(BaseSettings):
    PROJECT_NAME: str = "RIFT API"
    VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Server Ports
    RIFT_API_PORT: int = 8000
    RIFT_WEB_PORT: int = 5173

    # Database
    DATABASE_URL: str = Field(
        default_factory=_get_default_database_url,
        description="SQLAlchemy database connection string"
    )

    # Gemma & Ollama Engine
    RIFT_INFERENCE_PROVIDER: str = "local"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    GEMMA_MODEL: str = "gemma4:e2b"
    GEMMA_API_KEY: str = ""
    OLLAMA_API_KEY: str = ""
    GEMMA_TIMEOUT_SECONDS: int = 180
    GEMMA_MAX_CONCURRENT_REQUESTS: int = 1
    GEMMA_MAX_CONTEXT_TOKENS: int = 8192
    GEMMA_TEMPERATURE: float = 0.1

    # CORS - can be configured as a comma-separated string or list
    CORS_ORIGINS_RAW: Union[str, List[str]] = Field(
        default="http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000",
        alias="CORS_ORIGINS"
    )

    @property
    def CORS_ORIGINS(self) -> List[str]:
        val = self.CORS_ORIGINS_RAW
        if isinstance(val, list):
            return val
        if isinstance(val, str):
            if val.strip().startswith("[") and val.strip().endswith("]"):
                try:
                    return json.loads(val)
                except Exception:
                    pass
            return [x.strip() for x in val.split(",") if x.strip()]
        return ["*"]

    # Ingestion Limits
    MAX_IMPORT_PAYLOAD_BYTES: int = 10 * 1024 * 1024  # 10 MB
    MAX_IMPORT_SPANS: int = 2000

    # Optional Codebase Knowledge (Graphify)
    ENABLE_CODEBASE_KNOWLEDGE: bool = Field(default=True, alias="RIFT_ENABLE_CODEBASE_KNOWLEDGE")
    GRAPHIFY_EXECUTABLE_PATH: Optional[str] = Field(default="/Users/oggy/.local/bin/graphify", alias="RIFT_GRAPHIFY_EXECUTABLE")
    GRAPHIFY_GRAPH_PATH: str = Field(
        default_factory=lambda: os.path.join(_DETECTED_REPO_ROOT, "graphify-out", "graph.json"),
        alias="RIFT_GRAPHIFY_GRAPH_PATH"
    )
    GRAPHIFY_TIMEOUT_SECONDS: int = 15
    GRAPHIFY_MAX_QUERY_BUDGET: int = 4000
    REPO_ROOT: str = Field(
        default_factory=lambda: _DETECTED_REPO_ROOT,
        alias="RIFT_REPO_ROOT"
    )

    model_config = SettingsConfigDict(
        env_file=("/Users/oggy/RIFT/.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
