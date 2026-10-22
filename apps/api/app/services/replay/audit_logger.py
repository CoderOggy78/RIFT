import json
from typing import Dict, Any
from app.models.models import Replay


class ReplayAuditLogger:
    @staticmethod
    def generate_manifest(replay: Replay) -> Dict[str, Any]:
        """
        Produces an immutable, machine-readable JSON manifest recording all parameters,
        hashes, timestamps, and execution results of a replay session.
        """
        orig_variant = None
        cf_variant = None
        for v in (replay.variants or []):
            if v.variant_type == "original":
                orig_variant = v
            elif v.variant_type == "counterfactual":
                cf_variant = v

        cmp_rec = replay.comparison

        return {
            "schema_version": "1.0.0",
            "replay_id": replay.id,
            "incident_id": replay.incident_id,
            "investigation_id": replay.investigation_id,
            "original_event_id": replay.original_event_id,
            "fixture_id": replay.fixture_id,
            "status": replay.status,
            "approved_by_user": replay.approved_by_user,
            "approved_at": replay.approved_at.isoformat() if replay.approved_at else None,
            "started_at": replay.started_at.isoformat() if replay.started_at else None,
            "completed_at": replay.completed_at.isoformat() if replay.completed_at else None,
            "failure_code": replay.failure_code,
            "failure_message": replay.failure_message,
            "original_variant": {
                "operation_type": orig_variant.operation_type if orig_variant else None,
                "validated_arguments": orig_variant.validated_arguments if orig_variant else {},
                "execution_status": orig_variant.execution_status if orig_variant else None,
                "validation_status": orig_variant.validation_status if orig_variant else None,
                "duration_ms": orig_variant.duration_ms if orig_variant else None,
            } if orig_variant else None,
            "counterfactual_variant": {
                "operation_type": cf_variant.operation_type if cf_variant else None,
                "validated_arguments": cf_variant.validated_arguments if cf_variant else {},
                "execution_status": cf_variant.execution_status if cf_variant else None,
                "validation_status": cf_variant.validation_status if cf_variant else None,
                "duration_ms": cf_variant.duration_ms if cf_variant else None,
            } if cf_variant else None,
            "comparison": {
                "conclusion": cmp_rec.conclusion if cmp_rec else None,
                "original_validation": cmp_rec.original_validation_status if cmp_rec else None,
                "counterfactual_validation": cmp_rec.counterfactual_validation_status if cmp_rec else None,
                "changed_files": cmp_rec.changed_files if cmp_rec else [],
                "removed_files": cmp_rec.removed_files if cmp_rec else [],
                "added_files": cmp_rec.added_files if cmp_rec else [],
                "details": cmp_rec.details if cmp_rec else {},
            } if cmp_rec else None,
        }
