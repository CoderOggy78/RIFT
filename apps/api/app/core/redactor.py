import re
from typing import Any, Dict, List, Union

# Common secret regex patterns
SECRET_PATTERNS = [
    re.compile(r"Bearer\s+[A-Za-z0-9\-._~+/]+=*", re.IGNORECASE),
    re.compile(r"sk-[a-zA-Z0-9]{20,}", re.IGNORECASE),
    re.compile(r"AKIA[0-9A-Z]{16}", re.IGNORECASE),
    re.compile(r"AIza[0-9A-Za-z-_]{35}", re.IGNORECASE),
    re.compile(r"ghp_[a-zA-Z0-9]{36}", re.IGNORECASE),
    re.compile(r"xox[baprs]-[0-9a-zA-Z]{10,48}", re.IGNORECASE),
    re.compile(r"(-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----)"),
]

SENSITIVE_KEY_NAMES = {
    "password",
    "secret",
    "token",
    "api_key",
    "apikey",
    "access_token",
    "refresh_token",
    "authorization",
    "private_key",
    "client_secret",
    "auth_token",
}


def redact_string(val: str) -> str:
    """Scrub known secret formats from string payloads."""
    redacted = val
    for pattern in SECRET_PATTERNS:
        redacted = pattern.sub("[REDACTED_SECRET]", redacted)
    return redacted


def sanitize_payload(obj: Any) -> Any:
    """Recursively scrub sensitive values from dictionary or list payloads."""
    if isinstance(obj, dict):
        new_dict: Dict[str, Any] = {}
        for k, v in obj.items():
            if str(k).lower() in SENSITIVE_KEY_NAMES:
                new_dict[k] = "[REDACTED_SENSITIVE_FIELD]"
            else:
                new_dict[k] = sanitize_payload(v)
        return new_dict
    elif isinstance(obj, list):
        return [sanitize_payload(item) for item in obj]
    elif isinstance(obj, str):
        return redact_string(obj)
    return obj
