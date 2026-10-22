import os
from pathlib import Path
from typing import List, Optional, Tuple

MAX_PATH_LENGTH = 255
FORBIDDEN_CHARACTERS = {"\0", "\r", "\n"}


class SecurityPolicyError(ValueError):
    """Raised when an operation violates path safety or sandbox boundaries."""
    pass


class SecurityPolicy:
    @staticmethod
    def validate_path_syntax(path_str: str) -> None:
        if not path_str or not path_str.strip():
            raise SecurityPolicyError("Path cannot be empty or whitespace")

        if len(path_str) > MAX_PATH_LENGTH:
            raise SecurityPolicyError(f"Path exceeds maximum length of {MAX_PATH_LENGTH} characters")

        for c in FORBIDDEN_CHARACTERS:
            if c in path_str:
                raise SecurityPolicyError(f"Forbidden character in path: {repr(c)}")

        cleaned = path_str.strip()
        # Reject absolute paths (Unix and Windows drive letters)
        if os.path.isabs(cleaned) or cleaned.startswith("/") or cleaned.startswith("\\"):
            raise SecurityPolicyError(f"Absolute paths are forbidden: '{path_str}'")

        if len(cleaned) > 1 and cleaned[1] == ":" and cleaned[0].isalpha():
            raise SecurityPolicyError(f"Windows drive letters are forbidden: '{path_str}'")

        # Reject directory traversal components
        parts = Path(cleaned).parts
        if ".." in parts:
            raise SecurityPolicyError(f"Parent directory traversal ('..') is forbidden: '{path_str}'")

    @staticmethod
    def resolve_sandbox_path(workspace: Path, path_str: str) -> Path:
        SecurityPolicy.validate_path_syntax(path_str)

        workspace_resolved = workspace.resolve()
        target_resolved = (workspace / path_str.strip()).resolve()

        try:
            target_resolved.relative_to(workspace_resolved)
        except ValueError:
            raise SecurityPolicyError(f"Path escapes sandbox workspace boundaries: '{path_str}'")

        # Check symlink safety if candidate exists
        candidate = workspace / path_str.strip()
        if candidate.is_symlink():
            real_target = candidate.resolve()
            try:
                real_target.relative_to(workspace_resolved)
            except ValueError:
                raise SecurityPolicyError(f"Symlink escapes sandbox workspace: '{path_str}'")

        return target_resolved

    @staticmethod
    def check_protected_path(relative_path: str, protected_paths: List[str]) -> Tuple[bool, Optional[str]]:
        """
        Returns (is_protected, matching_rule) if relative_path matches any protected path.
        """
        norm_path = relative_path.replace("\\", "/").strip().lstrip("/")
        for prot in protected_paths:
            prot_norm = prot.replace("\\", "/").strip().lstrip("/")
            if norm_path == prot_norm or norm_path.startswith(f"{prot_norm}/"):
                return True, prot
        return False, None
