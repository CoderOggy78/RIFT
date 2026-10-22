import re
from typing import Any, Dict, List, Union

# Common credential and token regex patterns
CREDENTIAL_PATTERNS = [
    # API Keys & Secrets
    (re.compile(r"sk-[a-zA-Z0-9_-]{20,}", re.IGNORECASE), "[REDACTED_API_KEY]"),
    (re.compile(r"sk-ant-[a-zA-Z0-9_-]{20,}", re.IGNORECASE), "[REDACTED_API_KEY]"),
    (re.compile(r"ghp_[a-zA-Z0-9]{36}", re.IGNORECASE), "[REDACTED_GITHUB_TOKEN]"),
    (re.compile(r"AKIA[0-9A-Z]{16}", re.IGNORECASE), "[REDACTED_AWS_KEY]"),
    # Bearer tokens
    (re.compile(r"Bearer\s+[a-zA-Z0-9_\-\.]{20,}", re.IGNORECASE), "Bearer [REDACTED_TOKEN]"),
    # JWT tokens
    (re.compile(r"ey[a-zA-Z0-9_-]+\.ey[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+"), "[REDACTED_JWT]"),
    # Private keys
    (re.compile(r"-----BEGIN\s+[A-Z\s]+KEY-----[\s\S]+?-----END\s+[A-Z\s]+KEY-----"), "[REDACTED_PRIVATE_KEY]"),
    # Basic password in connection strings
    (re.compile(r"://([^:]+):([^@]+)@"), r"://\1:[REDACTED_PASSWORD]@"),
]

SENSITIVE_KEY_NAMES = {
    "password",
    "secret",
    "token",
    "api_key",
    "apikey",
    "access_token",
    "auth",
    "authorization",
    "private_key",
    "credentials",
    "client_secret",
}


def redact_string(text: str) -> str:
    """Masks known token, key, and credential patterns within a string."""
    if not text or not isinstance(text, str):
        return text

    sanitized = text
    for pattern, replacement in CREDENTIAL_PATTERNS:
        sanitized = pattern.sub(replacement, sanitized)
    return sanitized


def redact_payload(obj: Any) -> Any:
    """
    Recursively redacts sensitive keys and values from dictionaries, lists, or primitive values.
    Returns a copy with sensitive data replaced with '[REDACTED]'.
    """
    if isinstance(obj, dict):
        cleaned: Dict[str, Any] = {}
        for k, v in obj.items():
            k_lower = str(k).lower()
            if any(sens in k_lower for sens in SENSITIVE_KEY_NAMES):
                cleaned[k] = "[REDACTED_CREDENTIAL]"
            else:
                cleaned[k] = redact_payload(v)
        return cleaned
    elif isinstance(obj, list):
        return [redact_payload(item) for item in obj]
    elif isinstance(obj, str):
        return redact_string(obj)
    return obj


class RedactionService:
    @staticmethod
    def redact_payload(obj: Any) -> Any:
        return redact_payload(obj)

    @staticmethod
    def redact_string(text: str) -> str:
        return redact_string(text)
