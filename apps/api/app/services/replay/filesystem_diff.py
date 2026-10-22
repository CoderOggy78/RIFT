import difflib
from pathlib import Path
from typing import Dict, Any, List, Optional


class FilesystemDiff:
    @staticmethod
    def compute_diff(
        pre_manifest: Dict[str, Any],
        post_manifest: Dict[str, Any],
        pre_files: Optional[Dict[str, str]] = None,
        workspace_path: Optional[Path] = None,
    ) -> Dict[str, Any]:
        """
        Computes added, removed, modified, and unchanged files.
        Optionally generates unified text diffs for modified text files.
        """
        pre_keys = set(pre_manifest.keys())
        post_keys = set(post_manifest.keys())

        added_files = sorted(list(post_keys - pre_keys))
        removed_files = sorted(list(pre_keys - post_keys))
        common_files = pre_keys & post_keys

        modified_files = []
        unchanged_files = []
        file_diffs = {}

        for k in sorted(list(common_files)):
            pre_hash = pre_manifest[k].get("hash")
            post_hash = post_manifest[k].get("hash")

            if pre_hash != post_hash:
                modified_files.append(k)
                # Compute unified diff if contents are available
                diff_text = None
                old_content = pre_files.get(k) if pre_files else None
                new_content = None

                if workspace_path and (workspace_path / k).exists():
                    try:
                        new_content = (workspace_path / k).read_text(encoding="utf-8")
                    except Exception:
                        pass

                if old_content is not None and new_content is not None:
                    diff_lines = list(difflib.unified_diff(
                        old_content.splitlines(keepends=True),
                        new_content.splitlines(keepends=True),
                        fromfile=f"a/{k}",
                        tofile=f"b/{k}",
                    ))
                    diff_text = "".join(diff_lines)

                file_diffs[k] = {
                    "pre_hash": pre_hash,
                    "post_hash": post_hash,
                    "diff": diff_text,
                }
            else:
                unchanged_files.append(k)

        return {
            "added_files": added_files,
            "removed_files": removed_files,
            "modified_files": modified_files,
            "unchanged_files": unchanged_files,
            "file_diffs": file_diffs,
            "total_changes": len(added_files) + len(removed_files) + len(modified_files),
        }
