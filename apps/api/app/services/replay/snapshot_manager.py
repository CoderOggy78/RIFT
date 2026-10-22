import os
import shutil
import hashlib
import tempfile
from pathlib import Path
from typing import Dict, Any, Tuple


class SnapshotManager:
    @staticmethod
    def create_isolated_workspace(initial_files: Dict[str, str]) -> Tuple[Path, Dict[str, Any]]:
        """
        Creates a new, isolated temporary directory initialized with fixture files.
        Returns (workspace_path, pre_execution_manifest).
        """
        temp_dir = Path(tempfile.mkdtemp(prefix="rift_sandbox_"))

        pre_manifest = {}
        for rel_path, content in initial_files.items():
            target_file = temp_dir / rel_path
            target_file.parent.mkdir(parents=True, exist_ok=True)
            target_file.write_text(content, encoding="utf-8")

            data = content.encode("utf-8")
            pre_manifest[rel_path] = {
                "size_bytes": len(data),
                "hash": hashlib.sha256(data).hexdigest(),
            }

        return temp_dir, pre_manifest

    @staticmethod
    def scan_manifest(workspace_path: Path) -> Dict[str, Any]:
        """Scans current workspace and generates a content hash manifest."""
        manifest = {}
        if not workspace_path.exists():
            return manifest

        for p in sorted(workspace_path.rglob("*")):
            if p.is_file():
                rel = str(p.relative_to(workspace_path)).replace("\\", "/")
                try:
                    data = p.read_bytes()
                    manifest[rel] = {
                        "size_bytes": len(data),
                        "hash": hashlib.sha256(data).hexdigest(),
                    }
                except Exception as e:
                    manifest[rel] = {"error": str(e)}
        return manifest

    @staticmethod
    def cleanup_workspace(workspace_path: Path) -> None:
        """Safely removes the temporary workspace."""
        if workspace_path and workspace_path.exists():
            try:
                shutil.rmtree(workspace_path, ignore_errors=True)
            except Exception:
                pass
