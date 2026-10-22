import os
from pathlib import Path


def resolve_secure_path(workspace: Path, user_path: str) -> Path:
    """
    Resolve user path relative to workspace, strictly enforcing sandbox boundaries.
    Rejects:
    - Absolute paths
    - Parent directory traversal ('..')
    - Symlinks pointing outside workspace
    - Null bytes and empty strings
    """
    if not user_path or not user_path.strip():
        raise ValueError("File path cannot be empty")

    if "\0" in user_path:
        raise ValueError("Null bytes in path are forbidden")

    cleaned = user_path.strip()
    if os.path.isabs(cleaned) or cleaned.startswith("/") or cleaned.startswith("\\") or (len(cleaned) > 1 and cleaned[1] == ":"):
        raise ValueError(f"Absolute paths are forbidden: '{cleaned}'")

    parts = Path(cleaned).parts
    if ".." in parts:
        raise ValueError(f"Parent directory traversal ('..') is forbidden: '{cleaned}'")

    workspace_resolved = workspace.resolve()
    target_resolved = (workspace / cleaned).resolve()

    try:
        target_resolved.relative_to(workspace_resolved)
    except ValueError:
        raise ValueError(f"Path escape attempt detected: '{cleaned}'")

    # If file exists and is a symlink, verify symlink target stays within workspace
    candidate = workspace / cleaned
    if candidate.is_symlink():
        real_target = candidate.resolve()
        try:
            real_target.relative_to(workspace_resolved)
        except ValueError:
            raise ValueError(f"Symlink escapes sandbox workspace: '{cleaned}'")

    return target_resolved
