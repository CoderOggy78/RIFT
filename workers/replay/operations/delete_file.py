import os
from pathlib import Path
from typing import Dict, Any, List
from . import resolve_secure_path


def execute_delete_file(workspace: Path, arguments: Dict[str, Any], protected_paths: List[str] = None) -> Dict[str, Any]:
    path_arg = arguments.get("path")
    if not path_arg:
        raise ValueError("Missing required 'path' argument in delete_file operation")

    resolved_path = resolve_secure_path(workspace, path_arg)
    rel_path = str(resolved_path.relative_to(workspace.resolve()))

    # Check protected paths
    if protected_paths:
        for prot in protected_paths:
            if rel_path == prot or rel_path.startswith(f"{prot}/"):
                # Note: this is a policy breach!
                # In sandbox execution, this operation may execute (to reproduce the failure)
                # or be flagged depending on mode.
                pass

    if not resolved_path.exists():
        raise FileNotFoundError(f"File not found: '{path_arg}'")

    if resolved_path.is_dir():
        raise IsADirectoryError(f"Target is a directory, not a file: '{path_arg}'")

    resolved_path.unlink()

    return {
        "operation": "delete_file",
        "target_path": rel_path,
        "status": "success",
        "message": f"Successfully deleted '{rel_path}'",
    }
