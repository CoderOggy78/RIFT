from pathlib import Path
from typing import Dict, Any, List
from . import resolve_secure_path

MAX_FILE_SIZE_BYTES = 1024 * 1024  # 1 MB limit


def execute_write_file(workspace: Path, arguments: Dict[str, Any], protected_paths: List[str] = None) -> Dict[str, Any]:
    path_arg = arguments.get("path")
    if not path_arg:
        raise ValueError("Missing required 'path' argument in write_file operation")

    content = arguments.get("content", "")
    if not isinstance(content, str):
        raise TypeError("'content' must be a string")

    content_bytes = content.encode("utf-8")
    if len(content_bytes) > MAX_FILE_SIZE_BYTES:
        raise ValueError(f"Content exceeds maximum allowable size of {MAX_FILE_SIZE_BYTES} bytes")

    resolved_path = resolve_secure_path(workspace, path_arg)
    rel_path = str(resolved_path.relative_to(workspace.resolve()))

    # Create parent directory if needed
    resolved_path.parent.mkdir(parents=True, exist_ok=True)

    with open(resolved_path, "w", encoding="utf-8") as f:
        f.write(content)

    return {
        "operation": "write_file",
        "target_path": rel_path,
        "bytes_written": len(content_bytes),
        "status": "success",
        "message": f"Successfully wrote {len(content_bytes)} bytes to '{rel_path}'",
    }
