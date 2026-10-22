import time
import json
import uuid
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from sqlalchemy.orm import Session

from app.models.models import Replay, ReplayVariant, ReplayArtifact, ReplayComparison, Incident, Span
from .security_policy import SecurityPolicy, SecurityPolicyError
from .operation_validator import OperationValidator, OperationValidationError
from .fixture_manager import FixtureManager, FixtureIntegrityError
from .snapshot_manager import SnapshotManager
from .filesystem_diff import FilesystemDiff
from .validation_runner import ValidationRunner
from .result_comparator import ResultComparator
from .sandbox import SandboxOrchestrator, SandboxUnavailableError

import sys
REPO_ROOT = Path(__file__).resolve().parents[5]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# Import worker operations for isolated execution
from workers.replay.operations.delete_file import execute_delete_file
from workers.replay.operations.write_file import execute_write_file
from workers.replay.operations.move_file import execute_move_file
from workers.replay.operations.run_validation import execute_run_validation
from workers.replay.validators.fixture_integrity import check_fixture_integrity


class ReplayOrchestrator:
    @staticmethod
    def generate_preview(
        db: Session,
        incident_id: str,
        counterfactual_operation: str,
        counterfactual_arguments: Dict[str, Any],
        fixture_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generates a dry-run preview comparing original tool-call vs proposed counterfactual operation.
        Does NOT execute code or touch files.
        """
        incident = db.query(Incident).filter(Incident.id == incident_id).first()
        if not incident:
            raise ValueError(f"Incident '{incident_id}' not found")

        # Resolve fixture
        fixture = None
        if fixture_id:
            fixture = FixtureManager.load_fixture(fixture_id)
        if not fixture:
            fixture = FixtureManager.get_fixture_for_incident(incident_id)

        if not fixture:
            raise ValueError(f"No replay fixture found for incident '{incident_id}'")

        # Resolve original event
        original_event_id = fixture.get("original_event_id") or incident.first_suspicious_event_id
        original_op_spec = fixture.get("original_operation", {"operation": "delete_file", "arguments": {"path": "src/config.ts"}})

        # Validate counterfactual arguments against fixture policy
        validated_cf = OperationValidator.validate_operation(
            operation_name=counterfactual_operation,
            arguments=counterfactual_arguments,
            protected_paths=fixture.get("protected_paths", []),
        )

        # Validate original operation
        validated_orig = OperationValidator.validate_operation(
            operation_name=original_op_spec.get("operation", "delete_file"),
            arguments=original_op_spec.get("arguments", {}),
            protected_paths=fixture.get("protected_paths", []),
        )

        capabilities = SandboxOrchestrator.get_capabilities()

        return {
            "incident_id": incident.id,
            "incident_title": incident.title,
            "original_event_id": original_event_id,
            "fixture": {
                "fixture_id": fixture["fixture_id"],
                "title": fixture.get("title"),
                "description": fixture.get("description"),
                "protected_paths": fixture.get("protected_paths", []),
                "permitted_paths": fixture.get("permitted_paths", []),
                "initial_files": list(fixture.get("initial_files", {}).keys()),
            },
            "original_preview": {
                "operation": validated_orig["operation"],
                "arguments": validated_orig["validated_arguments"],
                "target_paths": validated_orig["target_paths"],
                "affects_protected": validated_orig["affects_protected"],
                "matching_protected_rule": validated_orig["matching_protected_rule"],
            },
            "counterfactual_preview": {
                "operation": validated_cf["operation"],
                "arguments": validated_cf["validated_arguments"],
                "target_paths": validated_cf["target_paths"],
                "affects_protected": validated_cf["affects_protected"],
                "matching_protected_rule": validated_cf["matching_protected_rule"],
            },
            "sandbox_capabilities": capabilities,
            "can_execute": capabilities["available"],
            "requires_explicit_approval": True,
        }

    @classmethod
    def execute_replay_session(
        cls,
        db: Session,
        replay_id: str,
        allow_isolated_fallback: bool = False,
    ) -> Replay:
        """
        Executes an approved replay session through independent isolated sandboxes.
        """
        replay = db.query(Replay).filter(Replay.id == replay_id).first()
        if not replay:
            raise ValueError(f"Replay '{replay_id}' not found")

        if not replay.approved_by_user:
            raise SecurityPolicyError("Explicit user approval is strictly required before running replay.")

        capabilities = SandboxOrchestrator.get_capabilities()
        if not capabilities["available"] and not allow_isolated_fallback:
            replay.status = "failed"
            replay.failure_code = "SANDBOX_UNAVAILABLE"
            replay.failure_message = "Secure replay is unavailable in this environment. Docker isolation is required."
            db.commit()
            raise SandboxUnavailableError(replay.failure_message)

        replay.status = "running"
        replay.started_at = datetime.now(timezone.utc)
        db.commit()

        fixture = FixtureManager.load_fixture(replay.fixture_id)
        if not fixture:
            replay.status = "failed"
            replay.failure_code = "FIXTURE_NOT_FOUND"
            replay.failure_message = f"Fixture '{replay.fixture_id}' could not be loaded."
            db.commit()
            return replay

        initial_files = fixture.get("initial_files", {})
        protected_paths = fixture.get("protected_paths", [])
        validators_spec = fixture.get("validators", [{}])[0]

        orig_variant = db.query(ReplayVariant).filter(
            ReplayVariant.replay_id == replay.id,
            ReplayVariant.variant_type == "original",
        ).first()

        cf_variant = db.query(ReplayVariant).filter(
            ReplayVariant.replay_id == replay.id,
            ReplayVariant.variant_type == "counterfactual",
        ).first()

        if not orig_variant or not cf_variant:
            replay.status = "failed"
            replay.failure_code = "INVALID_VARIANTS"
            replay.failure_message = "Replay variants are missing."
            db.commit()
            return replay

        # Run Variant A: Original
        orig_res = cls._run_variant(
            variant_type="original",
            operation=orig_variant.operation_type,
            arguments=orig_variant.validated_arguments,
            initial_files=initial_files,
            protected_paths=protected_paths,
            validation_spec=validators_spec,
        )

        # Run Variant B: Counterfactual (from identical clean initial snapshot)
        cf_res = cls._run_variant(
            variant_type="counterfactual",
            operation=cf_variant.operation_type,
            arguments=cf_variant.validated_arguments,
            initial_files=initial_files,
            protected_paths=protected_paths,
            validation_spec=validators_spec,
        )

        # Update ReplayVariant records
        orig_variant.execution_status = orig_res["execution_status"]
        orig_variant.validation_status = "passed" if orig_res["validation_result"].get("passed") else "failed"
        orig_variant.duration_ms = orig_res["duration_ms"]
        orig_variant.error_message = orig_res.get("operation_error")

        cf_variant.execution_status = cf_res["execution_status"]
        cf_variant.validation_status = "passed" if cf_res["validation_result"].get("passed") else "failed"
        cf_variant.duration_ms = cf_res["duration_ms"]
        cf_variant.error_message = cf_res.get("operation_error")

        # Compare results
        comparison_dict = ResultComparator.compare_variants(orig_res, cf_res)

        # Persist ReplayComparison
        existing_cmp = db.query(ReplayComparison).filter(ReplayComparison.replay_id == replay.id).first()
        if existing_cmp:
            db.delete(existing_cmp)

        comparison_rec = ReplayComparison(
            replay_id=replay.id,
            original_validation_status=comparison_dict["original_validation_status"],
            counterfactual_validation_status=comparison_dict["counterfactual_validation_status"],
            changed_files=comparison_dict["changed_files"],
            removed_files=comparison_dict["removed_files"],
            added_files=comparison_dict["added_files"],
            conclusion=comparison_dict["conclusion"],
            details=comparison_dict["details"],
            created_at=datetime.now(timezone.utc),
        )
        db.add(comparison_rec)

        # Persist Artifacts
        cls._persist_variant_artifacts(db, orig_variant.id, orig_res)
        cls._persist_variant_artifacts(db, cf_variant.id, cf_res)

        replay.status = "completed"
        replay.completed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(replay)
        return replay

    @classmethod
    def _run_variant(
        cls,
        variant_type: str,
        operation: str,
        arguments: Dict[str, Any],
        initial_files: Dict[str, str],
        protected_paths: list,
        validation_spec: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Executes a single variant inside an independent ephemeral scratch workspace.
        """
        start_t = time.time()
        ws_path, pre_manifest = SnapshotManager.create_isolated_workspace(initial_files)

        op_result = None
        op_error = None
        execution_status = "success"

        try:
            if operation == "delete_file":
                op_result = execute_delete_file(ws_path, arguments, protected_paths)
            elif operation == "write_file":
                op_result = execute_write_file(ws_path, arguments, protected_paths)
            elif operation == "move_file":
                op_result = execute_move_file(ws_path, arguments, protected_paths)
            elif operation == "run_validation":
                validators = {"fixture-integrity": lambda ws: check_fixture_integrity(
                    ws,
                    validation_spec.get("required_files", []),
                    validation_spec.get("forbidden_files", []),
                )}
                op_result = execute_run_validation(ws_path, arguments, validators)
            else:
                raise ValueError(f"Unsupported operation: '{operation}'")
        except Exception as e:
            execution_status = "failed"
            op_error = str(e)

        # Run deterministic validation
        val_result = ValidationRunner.run_fixture_integrity_validator(
            ws_path,
            required_files=validation_spec.get("required_files", []),
            forbidden_files=validation_spec.get("forbidden_files", []),
        )

        post_manifest = SnapshotManager.scan_manifest(ws_path)
        fs_diff = FilesystemDiff.compute_diff(
            pre_manifest=pre_manifest,
            post_manifest=post_manifest,
            pre_files=initial_files,
            workspace_path=ws_path,
        )

        duration_ms = round((time.time() - start_t) * 1000, 2)

        # Clean up scratch environment
        SnapshotManager.cleanup_workspace(ws_path)

        return {
            "variant_type": variant_type,
            "operation": operation,
            "arguments": arguments,
            "execution_status": execution_status,
            "operation_result": op_result,
            "operation_error": op_error,
            "validation_result": val_result,
            "pre_manifest": pre_manifest,
            "post_manifest": post_manifest,
            "filesystem_diff": fs_diff,
            "duration_ms": duration_ms,
        }

    @staticmethod
    def _persist_variant_artifacts(db: Session, variant_id: str, res: Dict[str, Any]) -> None:
        diff_data = res.get("filesystem_diff", {})
        for path, info in diff_data.get("file_diffs", {}).items():
            if info.get("diff"):
                art = ReplayArtifact(
                    replay_variant_id=variant_id,
                    artifact_type="diff",
                    relative_path=path,
                    content_hash=info.get("post_hash") or "unknown",
                    artifact_metadata={"diff": info["diff"]},
                    created_at=datetime.now(timezone.utc),
                )
                db.add(art)
