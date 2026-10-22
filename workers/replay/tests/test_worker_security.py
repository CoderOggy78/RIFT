import pytest
import tempfile
from pathlib import Path

from workers.replay.operations import resolve_secure_path
from workers.replay.operations.delete_file import execute_delete_file
from workers.replay.operations.write_file import execute_write_file
from workers.replay.operations.move_file import execute_move_file
from workers.replay.validators.fixture_integrity import check_fixture_integrity


def test_resolve_secure_path_rejects_parent_traversal():
    with tempfile.TemporaryDirectory() as tmpdir:
        ws = Path(tmpdir)
        with pytest.raises(ValueError, match="Parent directory traversal"):
            resolve_secure_path(ws, "../outside.txt")
        with pytest.raises(ValueError, match="Parent directory traversal"):
            resolve_secure_path(ws, "sub/../../outside.txt")


def test_resolve_secure_path_rejects_absolute_path():
    with tempfile.TemporaryDirectory() as tmpdir:
        ws = Path(tmpdir)
        with pytest.raises(ValueError, match="Absolute paths are forbidden"):
            resolve_secure_path(ws, "/etc/passwd")


def test_resolve_secure_path_rejects_null_byte():
    with tempfile.TemporaryDirectory() as tmpdir:
        ws = Path(tmpdir)
        with pytest.raises(ValueError, match="Null bytes"):
            resolve_secure_path(ws, "file\0.txt")


def test_resolve_secure_path_rejects_symlink_escape():
    with tempfile.TemporaryDirectory() as tmpdir:
        ws = Path(tmpdir)
        outside_dir = ws.parent / "outside_dir"
        outside_dir.mkdir(exist_ok=True)
        outside_file = outside_dir / "secret.txt"
        outside_file.write_text("classified")

        link = ws / "symlink_escape"
        try:
            link.symlink_to(outside_file)
            with pytest.raises(ValueError, match="escape"):
                resolve_secure_path(ws, "symlink_escape")
        finally:
            if outside_file.exists():
                outside_file.unlink()
            if outside_dir.exists():
                outside_dir.rmdir()


def test_operations_lifecycle_inside_sandbox():
    with tempfile.TemporaryDirectory() as tmpdir:
        ws = Path(tmpdir)

        # 1. Write file
        w_res = execute_write_file(ws, {"path": "tmp/cache.json", "content": '{"test": 1}'})
        assert w_res["status"] == "success"
        assert (ws / "tmp/cache.json").exists()

        # 2. Move file
        m_res = execute_move_file(ws, {"source": "tmp/cache.json", "destination": "tmp/renamed.json"})
        assert m_res["status"] == "success"
        assert not (ws / "tmp/cache.json").exists()
        assert (ws / "tmp/renamed.json").exists()

        # 3. Delete file
        d_res = execute_delete_file(ws, {"path": "tmp/renamed.json"})
        assert d_res["status"] == "success"
        assert not (ws / "tmp/renamed.json").exists()


def test_fixture_integrity_validator():
    with tempfile.TemporaryDirectory() as tmpdir:
        ws = Path(tmpdir)
        (ws / "src").mkdir()
        (ws / "src/config.ts").write_text("export const x = 1;")
        (ws / "tmp").mkdir()
        (ws / "tmp/cache.json").write_text("{}")

        # Fails because tmp/cache.json is forbidden
        res = check_fixture_integrity(ws, required_files=["src/config.ts"], forbidden_files=["tmp/cache.json"])
        assert res["passed"] is False
        assert "tmp/cache.json" in res["found_forbidden"]

        # Delete cache.json
        (ws / "tmp/cache.json").unlink()

        # Now passes
        res2 = check_fixture_integrity(ws, required_files=["src/config.ts"], forbidden_files=["tmp/cache.json"])
        assert res2["passed"] is True
