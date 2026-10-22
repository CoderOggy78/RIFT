from pathlib import Path
from typing import Dict, Any, List
from . import resolve_secure_path


def execute_move_file(workspace: Path, arguments: Dict[str, Any], protected_paths: List[str] = None) -> Dict[str, Any]:
    source_arg = arguments.get("source")
    destination_arg = arguments.get("destination")

    if not source_arg or not destination_arg:
        raise ValueError("Missing required 'source' or 'destination' argument in move_file operation")

    resolved_src = resolve_secure_path(workspace, source_arg)
    resolved_dst = resolve_secure_path(workspace, destination_arg)

    rel_src = str(resolved_src.relative_to(workspace.resolve()))
    rel_dst = str(resolved_dst.relative_to(workspace.resolve()))

    if not resolved_src.exists():
        raise FileNotFoundError(f"Source file not found: '{source_arg}'")

    if resolved_src.is_dir():
        raise IsADirectoryError(f"Source is a directory, not a file: '{source_arg}'")

    resolved_dst.parent.mkdir(parents=True, exist_ok=True)
    resolved_src.rename(resolved_dst)

    return {
        "operation": "move_file",
        "source": rel_src,
        "destination": rel_dst,
        "status": "success",
        "message": f"Successfully moved '{rel_src}' to '{rel_dst}'",
    }
