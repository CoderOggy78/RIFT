import os
import re
from pathlib import PurePosixPath
from typing import List, Set, Optional


class DetectionPolicy:
    def __init__(
        self,
        allowed_deletion_prefixes: Optional[List[str]] = None,
        protected_patterns: Optional[List[str]] = None,
        repeated_failure_threshold: int = 3,
    ):
        self.allowed_deletion_prefixes = allowed_deletion_prefixes or [
            "tmp/",
            "temp/",
            ".cache/",
            "build/tmp/",
            "/tmp/",
            "var/tmp/",
        ]
        self.protected_patterns = protected_patterns or [
            "src/",
            "app/",
            "package.json",
            "tsconfig.json",
            "pyproject.toml",
            "poetry.lock",
            "yarn.lock",
            "package-lock.json",
            ".env",
            ".env.local",
            ".env.production",
            "alembic.ini",
            "Makefile",
            "Dockerfile",
            "docker-compose.yml",
            ".git/",
        ]
        self.repeated_failure_threshold = repeated_failure_threshold

        self.deletion_tools: Set[str] = {
            "delete",
            "delete_file",
            "remove_file",
            "rm",
            "unlink",
            "truncate",
            "delete_directory",
            "remove_directory",
            "shutil.rmtree",
        }

        self.modification_tools: Set[str] = {
            "write_file",
            "edit_file",
            "overwrite_file",
            "patch_file",
            "append_file",
            "replace_file_content",
            "multi_replace_file_content",
        }

    @staticmethod
    def canonicalize_path(raw_path: str) -> str:
        """
        Normalize and canonicalize path string, resolving redundant slashes and '..' traversal.
        Preserves relative or absolute structure cleanly.
        """
        if not raw_path:
            return ""
        clean = str(raw_path).replace("\\", "/").strip()
        if clean.startswith("./"):
            clean = clean[2:]
        try:
            parts = []
            for part in clean.split("/"):
                if part == "." or part == "":
                    continue
                elif part == "..":
                    if parts and parts[-1] != "..":
                        parts.pop()
                    else:
                        parts.append(part)
                else:
                    parts.append(part)
            resolved = "/".join(parts)
            return resolved or clean
        except Exception:
            return clean

    def is_path_allowed_for_deletion(self, raw_path: str) -> bool:
        """Checks if a canonicalized path is within allowed temporary/scratch directories."""
        canonical = self.canonicalize_path(raw_path)
        # Any traversal escaping into root or parent is explicitly NOT allowed
        if canonical.startswith("..") or "/../" in canonical:
            return False

        for prefix in self.allowed_deletion_prefixes:
            clean_prefix = prefix.rstrip("/")
            if canonical == clean_prefix or canonical.startswith(f"{clean_prefix}/"):
                return True
        return False

    def is_path_protected(self, raw_path: str) -> bool:
        """Checks if a target path matches any protected source/configuration patterns."""
        canonical = self.canonicalize_path(raw_path)
        # Clean canonical to strip any leading "../" or "./" or "/" cleanly
        normalized_target = canonical
        while normalized_target.startswith(("../", "./", "/")):
            if normalized_target.startswith("../"):
                normalized_target = normalized_target[3:]
            elif normalized_target.startswith("./"):
                normalized_target = normalized_target[2:]
            elif normalized_target.startswith("/"):
                normalized_target = normalized_target[1:]

        for pattern in self.protected_patterns:
            clean_pattern = pattern.rstrip("/")
            if pattern.endswith("/"):
                # Directory match
                if (
                    canonical == clean_pattern
                    or canonical.startswith(f"{clean_pattern}/")
                    or normalized_target == clean_pattern
                    or normalized_target.startswith(f"{clean_pattern}/")
                ):
                    return True
            else:
                # File exact match or filename match
                if (
                    canonical == pattern
                    or canonical.endswith(f"/{pattern}")
                    or normalized_target == pattern
                    or normalized_target.endswith(f"/{pattern}")
                ):
                    return True
                # Match .env.* variants
                if pattern == ".env" and (".env" in canonical or ".env" in normalized_target):
                    return True
        return False


default_policy = DetectionPolicy()
