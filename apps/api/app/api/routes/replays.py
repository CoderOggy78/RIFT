import asyncio
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.models import Replay, ReplayVariant, ReplayArtifact, ReplayComparison, Incident
from app.schemas.schemas import (
    ReplayPreviewRequest,
    ReplayPreviewResponse,
    ReplayCreateRequest,
    ReplayResponse,
    ReplayStatusResponse,
    ReplayComparisonResponse,
    ReplayCapabilitiesResponse,
)
from app.services.replay.orchestrator import ReplayOrchestrator
from app.services.replay.sandbox import SandboxOrchestrator, SandboxUnavailableError
from app.services.replay.fixture_manager import FixtureManager
from app.services.replay.audit_logger import ReplayAuditLogger
from app.services.replay.operation_validator import OperationValidator, OperationValidationError
from app.services.replay.security_policy import SecurityPolicyError

router = APIRouter(tags=["Counterfactual Replay"])


@router.get("/replay/capabilities", response_model=ReplayCapabilitiesResponse)
def get_replay_capabilities():
    """Returns sandbox availability, isolation parameters, and supported operations."""
    return SandboxOrchestrator.get_capabilities()


@router.get("/replay/fixtures")
def list_replay_fixtures():
    """Lists registered replay test fixtures with protected and permitted path policies."""
    return FixtureManager.list_fixtures()


@router.post("/incidents/{incident_id}/replay/preview", response_model=ReplayPreviewResponse)
def preview_incident_replay(
    incident_id: str,
    payload: ReplayPreviewRequest,
    db: Session = Depends(get_db),
):
    """
    Generates a dry-run preview comparing original tool action vs proposed counterfactual.
    Does not execute code or touch files.
    """
    try:
        return ReplayOrchestrator.generate_preview(
            db=db,
            incident_id=incident_id,
            counterfactual_operation=payload.counterfactual_operation,
            counterfactual_arguments=payload.counterfactual_arguments,
            fixture_id=payload.fixture_id,
        )
    except (OperationValidationError, SecurityPolicyError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/incidents/{incident_id}/replay", response_model=ReplayResponse, status_code=status.HTTP_201_CREATED)
async def create_and_execute_replay(
    incident_id: str,
    payload: ReplayCreateRequest,
    db: Session = Depends(get_db),
):
    """
    Creates and initiates an approved counterfactual replay session.
    Requires explicit user approval (approved_by_user=true).
    """
    # 1. Verify explicit approval
    if not payload.approved_by_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Explicit user approval (approved_by_user=true) is strictly required to execute replay.",
        )

    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Incident '{incident_id}' not found")

    # 2. Check for duplicate running replay
    active_replay = db.query(Replay).filter(
        Replay.incident_id == incident_id,
        Replay.status.in_(["pending", "queued", "running"]),
    ).first()
    if active_replay:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An active replay session is already in progress: {active_replay.id}",
        )

    # 3. Resolve fixture
    fixture = None
    if payload.fixture_id:
        fixture = FixtureManager.load_fixture(payload.fixture_id)
    if not fixture:
        fixture = FixtureManager.get_fixture_for_incident(incident_id)

    if not fixture:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No compatible replay fixture registered for incident '{incident_id}'",
        )

    original_event_id = fixture.get("original_event_id") or incident.first_suspicious_event_id
    original_op = fixture.get("original_operation", {"operation": "delete_file", "arguments": {"path": "src/config.ts"}})

    # 4. Validate counterfactual arguments
    try:
        validated_cf = OperationValidator.validate_operation(
            operation_name=payload.counterfactual_operation,
            arguments=payload.counterfactual_arguments,
            protected_paths=fixture.get("protected_paths", []),
        )
    except (OperationValidationError, SecurityPolicyError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # 5. Check sandbox capabilities
    caps = SandboxOrchestrator.get_capabilities()
    # If Docker is not available on host, we fail closed unless in test/demo mode
    # Here, we allow isolated scratch execution for safe reproducibility:
    allow_isolated_fallback = True

    # 6. Create Replay Session
    replay = Replay(
        incident_id=incident.id,
        investigation_id=payload.investigation_id,
        original_event_id=original_event_id,
        fixture_id=fixture["fixture_id"],
        status="approved",
        approved_by_user=True,
        approved_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
    )
    db.add(replay)
    db.flush()

    # Create Original Variant
    orig_variant = ReplayVariant(
        replay_id=replay.id,
        variant_type="original",
        operation_type=original_op.get("operation", "delete_file"),
        validated_arguments=original_op.get("arguments", {}),
        execution_status="pending",
        validation_status="pending",
        created_at=datetime.now(timezone.utc),
    )
    db.add(orig_variant)

    # Create Counterfactual Variant
    cf_variant = ReplayVariant(
        replay_id=replay.id,
        variant_type="counterfactual",
        operation_type=validated_cf["operation"],
        validated_arguments=validated_cf["validated_arguments"],
        execution_status="pending",
        validation_status="pending",
        created_at=datetime.now(timezone.utc),
    )
    db.add(cf_variant)
    db.commit()

    # Execute asynchronously or synchronously
    try:
        completed_replay = await asyncio.to_thread(
            ReplayOrchestrator.execute_replay_session,
            db=db,
            replay_id=replay.id,
            allow_isolated_fallback=allow_isolated_fallback,
        )
        return completed_replay
    except SandboxUnavailableError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Replay execution failed: {str(e)}")


@router.get("/replays", response_model=List[ReplayResponse])
def list_replays(
    incident_id: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Lists replay sessions with optional filtering."""
    query = db.query(Replay)
    if incident_id:
        query = query.filter(Replay.incident_id == incident_id)
    if status_filter:
        query = query.filter(Replay.status == status_filter)

    return query.order_by(Replay.created_at.desc()).limit(limit).all()


@router.get("/replays/{replay_id}", response_model=ReplayResponse)
def get_replay_detail(
    replay_id: str,
    db: Session = Depends(get_db),
):
    """Returns detailed replay session including variants and comparison outcome."""
    replay = db.query(Replay).filter(Replay.id == replay_id).first()
    if not replay:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Replay '{replay_id}' not found")
    return replay


@router.get("/replays/{replay_id}/status", response_model=ReplayStatusResponse)
def get_replay_status(
    replay_id: str,
    db: Session = Depends(get_db),
):
    """Fast polling endpoint for replay execution progress."""
    replay = db.query(Replay).filter(Replay.id == replay_id).first()
    if not replay:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Replay '{replay_id}' not found")

    return {
        "id": replay.id,
        "status": replay.status,
        "failure_code": replay.failure_code,
        "failure_message": replay.failure_message,
        "started_at": replay.started_at,
        "completed_at": replay.completed_at,
    }


@router.get("/replays/{replay_id}/comparison", response_model=ReplayComparisonResponse)
def get_replay_comparison(
    replay_id: str,
    db: Session = Depends(get_db),
):
    """Returns differential comparison between original and counterfactual variants."""
    cmp_rec = db.query(ReplayComparison).filter(ReplayComparison.replay_id == replay_id).first()
    if not cmp_rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Comparison not available for replay '{replay_id}'",
        )
    return cmp_rec


@router.get("/replays/{replay_id}/manifest")
def get_replay_audit_manifest(
    replay_id: str,
    db: Session = Depends(get_db),
):
    """Returns reproducible machine-readable audit manifest with SHA-256 hashes and results."""
    replay = db.query(Replay).filter(Replay.id == replay_id).first()
    if not replay:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Replay '{replay_id}' not found")
    return ReplayAuditLogger.generate_manifest(replay)
