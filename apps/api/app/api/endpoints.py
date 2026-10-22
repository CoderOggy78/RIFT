import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import func, desc as sql_desc, asc as sql_asc

from pathlib import Path
from app.core.config import settings
from app.db.session import get_db
from app.models.models import (
    Project,
    Agent,
    Trace,
    Span,
    Incident,
    Detection,
    EvidenceReference,
    Investigation,
    Hypothesis,
    InvestigationEvidence,
    RemediationSuggestion,
    Replay,
    ReplayVariant,
    ReplayComparison,
)
from app.schemas.schemas import (
    HealthResponse,
    SystemStatusResponse,
    ModelStatusResponse,
    TraceSummaryResponse,
    TraceDetailResponse,
    TraceImportResponse,
    TraceImportPayload,
    DemoLoadResponse,
    DemoStatusResponse,
    ProjectResponse,
    AgentResponse,
    SpanResponse,
    IncidentResponse,
    IncidentDetailResponse,
    DetectionResponse,
    EvidenceReferenceResponse,
    DetectionRuleResponse,
    DetectionSummaryResponse,
    ExecutionGraphResponse,
    InvestigationContextResponse,
    EventDetailResponse,
    InvestigationResponse,
    InvestigationDetailResponse,
    InvestigationStatusResponse,
    InvestigationEvidenceResponse,
    HypothesisResponse,
    RemediationResponse,
    ModelTestResponse,
    ModelSettingsInput,
    ModelSettingsResponse,
    DiagnosticCheckItem,
    SystemDiagnosticsResponse,
    ReportItemResponse,
    CodeKnowledgeStatusResponse,
    CodeCommunitySummary,
    CodeKnowledgeGraphResponse,
    CodeKnowledgeQueryRequest,
    CodeKnowledgeQueryResponse,
    CodeKnowledgeExplainResponse,
    CodeKnowledgeRefreshResponse,
    FilePreviewResponse,
    CodeImpactRequest,
    CodeImpactResponse,
    IncidentCodeImpactResponse,
    TraceCodeImpactResponse,
    ValidationRunRequest,
    ValidationRunResult,
)
from app.services.code_knowledge import code_knowledge_service
from fastapi.responses import PlainTextResponse, JSONResponse
import time, os, sys
from datetime import datetime, timezone
from app.services.trace_service import TraceService
from app.services.ollama_service import OllamaService
from app.services.detection.engine import DetectionEngine
from app.services.detection.registry import registry
from app.services.detection.severity import Severity, normalize_severity
from app.services.investigation_service import InvestigationService
from app.services.ai.model_health import ModelHealthService
from app.services.ai.investigation_jobs import InvestigationJobManager

router = APIRouter()


# ==========================================
# System & Health
# ==========================================

@router.get("/health", response_model=HealthResponse, tags=["System"])
def get_health(db: Session = Depends(get_db)):
    """Healthcheck endpoint for container orchestration and uptime monitoring."""
    db_status = "connected"
    try:
        db.execute(func.now())
    except Exception:
        db_status = "error"

    return HealthResponse(
        status="healthy" if db_status == "connected" else "degraded",
        version=settings.VERSION,
        environment=settings.ENVIRONMENT,
        database=db_status,
    )


@router.get("/system/status", response_model=SystemStatusResponse, tags=["System"])
async def get_system_status(db: Session = Depends(get_db)):
    """Summary of platform health, database record counts, and Ollama/Gemma state."""
    db_connected = True
    total_traces = 0
    total_agents = 0
    total_projects = 0
    total_incidents = 0
    total_investigations = 0
    total_replays = 0
    try:
        total_traces = db.query(func.count(Trace.id)).scalar() or 0
        total_agents = db.query(func.count(Agent.id)).scalar() or 0
        total_projects = db.query(func.count(Project.id)).scalar() or 0
        total_incidents = db.query(func.count(Incident.id)).scalar() or 0
        total_investigations = db.query(func.count(Investigation.id)).scalar() or 0
        total_replays = db.query(func.count(Replay.id)).scalar() or 0
    except Exception:
        db_connected = False

    model_status = await OllamaService.check_status()

    return SystemStatusResponse(
        status="operational" if db_connected else "degraded",
        version=settings.VERSION,
        database_connected=db_connected,
        total_traces=total_traces,
        total_agents=total_agents,
        total_projects=total_projects,
        total_incidents=total_incidents,
        total_investigations=total_investigations,
        total_replays=total_replays,
        ollama_status=model_status.status,
        configured_model=settings.GEMMA_MODEL or "none",
    )


# ==========================================
# Single Synthetic Demo Management
# ==========================================

@router.get("/demo/status", response_model=DemoStatusResponse, tags=["Demo"])
def get_synthetic_demo_status(db: Session = Depends(get_db)):
    """Check whether the single official synthetic demo trace is currently loaded in the database."""
    demo_trace_id = "trace-accidental-deletion-001"
    trace = db.query(Trace).filter(Trace.id == demo_trace_id).first()
    if not trace:
        return DemoStatusResponse(is_loaded=False)

    incident = db.query(Incident).filter(Incident.trace_id == demo_trace_id).first()
    return DemoStatusResponse(
        is_loaded=True,
        trace_id=demo_trace_id,
        incident_id=incident.id if incident else None,
        title="Accidental Source Deletion",
        is_synthetic_demo=True,
    )


@router.post("/demo/load", response_model=DemoLoadResponse, tags=["Demo"])
def load_synthetic_demo(db: Session = Depends(get_db)):
    """
    Idempotently load the single official synthetic demonstration scenario:
    Accidental Source Deletion (fixtures/incidents/accidental-deletion.json).
    Executes real deterministic detection to detect the incident from telemetry.
    Loading repeatedly never creates duplicate records.
    """
    candidates = [
        Path(__file__).resolve().parents[4] / "fixtures" / "incidents" / "accidental-deletion.json",
        Path("/Users/oggy/RIFT/fixtures/incidents/accidental-deletion.json"),
    ]
    fixture_path = next((p for p in candidates if p.exists()), None)
    if not fixture_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Official synthetic demo fixture 'accidental-deletion.json' not found."
        )

    with open(fixture_path, "r", encoding="utf-8") as f:
        fixture_data = json.load(f)

    payload = TraceImportPayload(**fixture_data)
    TraceService.import_trace(db, payload, overwrite=False)

    # Check if incident already detected for this demo trace to maintain stable IDs and prevent duplicate incidents
    existing_inc = db.query(Incident).filter(Incident.trace_id == payload.trace.id).first()
    if existing_inc:
        incident_id = existing_inc.id
    else:
        # Run deterministic incident detection
        incidents = DetectionEngine.run_detection(db=db, trace_id=payload.trace.id)
        incident_id = incidents[0].id if incidents else None

    return DemoLoadResponse(
        trace_id=payload.trace.id,
        incident_id=incident_id,
        title="Accidental Source Deletion",
        is_synthetic_demo=True,
        status="ready",
        message="Synthetic demo scenario loaded successfully.",
    )


@router.post("/demo/reset", tags=["Demo"])
def reset_synthetic_demo(db: Session = Depends(get_db)):
    """
    Reset and purge only synthetic demo records (trace 'trace-accidental-deletion-001' and its children)
    without touching any user-imported traces or real operational data.
    """
    demo_trace_id = "trace-accidental-deletion-001"
    trace = db.query(Trace).filter(Trace.id == demo_trace_id).first()
    if not trace:
        return {"status": "ok", "message": "Demo records are already clear."}

    incident_ids = [inc.id for inc in db.query(Incident).filter(Incident.trace_id == demo_trace_id).all()]

    for inc_id in incident_ids:
        replays = db.query(Replay).filter(Replay.incident_id == inc_id).all()
        for r in replays:
            db.query(ReplayComparison).filter(ReplayComparison.replay_id == r.id).delete(synchronize_session=False)
            db.query(ReplayVariant).filter(ReplayVariant.replay_id == r.id).delete(synchronize_session=False)
            db.delete(r)

        investigations = db.query(Investigation).filter(Investigation.incident_id == inc_id).all()
        for inv in investigations:
            db.query(InvestigationEvidence).filter(InvestigationEvidence.investigation_id == inv.id).delete(synchronize_session=False)
            db.query(Hypothesis).filter(Hypothesis.investigation_id == inv.id).delete(synchronize_session=False)
            db.query(RemediationSuggestion).filter(RemediationSuggestion.investigation_id == inv.id).delete(synchronize_session=False)
            db.delete(inv)

        db.query(EvidenceReference).filter(EvidenceReference.trace_id == demo_trace_id).delete(synchronize_session=False)
        db.query(Detection).filter(Detection.incident_id == inc_id).delete(synchronize_session=False)
        db.query(Incident).filter(Incident.id == inc_id).delete(synchronize_session=False)

    db.query(Span).filter(Span.trace_id == demo_trace_id).delete(synchronize_session=False)
    db.delete(trace)
    db.commit()

    return {"status": "success", "message": "Synthetic demo records purged successfully."}


@router.get("/models/status", response_model=ModelStatusResponse, tags=["Gemma Engine"])
async def get_model_status():
    """Verify connectivity with Ollama and check availability of the configured Gemma model."""
    data = await ModelHealthService.get_health_status()
    return ModelStatusResponse(**data)


@router.post("/models/test", response_model=ModelTestResponse, tags=["Gemma Engine"])
async def test_model_inference():
    """Execute a real, bounded inference roundtrip with Gemma to verify local readiness."""
    data = await ModelHealthService.test_inference()
    return ModelTestResponse(**data)


@router.get("/models/settings", response_model=ModelSettingsResponse, tags=["Gemma Engine"])
async def get_model_settings():
    """Retrieve current inference provider configuration and installed model capabilities."""
    health = await ModelHealthService.get_health_status()
    available_models = health.get("available_models", [])
    configured_model = settings.GEMMA_MODEL
    is_installed = any(
        m == configured_model or m.startswith(f"{configured_model}:") or configured_model.startswith(f"{m}:")
        for m in available_models
    )
    return ModelSettingsResponse(
        configured_model=configured_model,
        provider=settings.RIFT_INFERENCE_PROVIDER,
        ollama_base_url=settings.OLLAMA_BASE_URL,
        available_models=available_models,
        is_model_installed=is_installed,
        cloud_configured=bool(settings.OLLAMA_API_KEY),
        message=health.get("message", "Model settings loaded."),
    )


@router.post("/models/settings", response_model=ModelSettingsResponse, tags=["Gemma Engine"])
async def update_model_settings(payload: ModelSettingsInput):
    """
    Update inference settings (model selection and provider).
    Cloud provider requires explicit consent because incident traces may contain sensitive information.
    Does not automatically download models without approval.
    """
    if payload.provider == "cloud" and not payload.cloud_consent_acknowledged:
        raise HTTPException(
            status_code=400,
            detail="Cloud inference requires explicit user consent because incident telemetry may contain sensitive data.",
        )

    from app.services.ai.model_registry import ModelRegistry
    if not ModelRegistry.is_gemma_family(payload.model_name):
        raise HTTPException(
            status_code=400,
            detail=f"Model '{payload.model_name}' is not a Google Gemma model. RIFT requires Gemma.",
        )

    health = await ModelHealthService.get_health_status()
    available_models = health.get("available_models", [])
    is_installed = any(
        m == payload.model_name or m.startswith(f"{payload.model_name}:") or payload.model_name.startswith(f"{m}:")
        for m in available_models
    )

    if payload.provider == "local" and not is_installed:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Model '{payload.model_name}' is not downloaded in Ollama. "
                f"Only downloaded models can be made available for local inference. "
                f"Run `ollama pull {payload.model_name}` to download it before activating."
            ),
        )

    # Update runtime settings
    settings.GEMMA_MODEL = payload.model_name.strip()
    settings.RIFT_INFERENCE_PROVIDER = payload.provider
    if payload.api_key is not None:
        settings.OLLAMA_API_KEY = payload.api_key.strip()

    msg = f"Inference configured with {settings.GEMMA_MODEL} ({settings.RIFT_INFERENCE_PROVIDER})."

    return ModelSettingsResponse(
        configured_model=settings.GEMMA_MODEL,
        provider=settings.RIFT_INFERENCE_PROVIDER,
        ollama_base_url=settings.OLLAMA_BASE_URL,
        available_models=available_models,
        is_model_installed=is_installed,
        cloud_configured=bool(settings.OLLAMA_API_KEY),
        message=msg,
    )


# ==========================================
# Traces
# ==========================================

@router.get("/traces", response_model=List[TraceSummaryResponse], tags=["Traces"])
def list_traces(
    status: Optional[str] = Query(None, description="Filter by status (e.g., success, error, running)"),
    search: Optional[str] = Query(None, description="Fuzzy search across objective, project, agent, or trace ID"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List execution traces with parent project, agent details, and execution duration."""
    traces = TraceService.list_traces(db=db, status=status, search=search, limit=limit, offset=offset)
    # Enrich with incident count
    enriched = []
    for t in traces:
        inc_count = db.query(func.count(Incident.id)).filter(Incident.trace_id == t.id).scalar() or 0
        t_dict = t.model_dump()
        t_dict["incident_count"] = inc_count
        enriched.append(TraceSummaryResponse(**t_dict))
    return enriched


@router.post("/traces/import", response_model=TraceImportResponse, status_code=status.HTTP_201_CREATED, tags=["Traces"])
def import_trace(
    payload: TraceImportPayload,
    overwrite: bool = Query(False, description="Whether to replace an existing trace with the same ID"),
    run_detect: bool = Query(True, description="Automatically run deterministic incident detection on import"),
    db: Session = Depends(get_db),
):
    """
    Ingest an AI agent execution trace with structured spans, tool calls, and results.
    Validates parent-child hierarchies, detects cyclic span graphs, scrubs credentials,
    and runs deterministic incident detection.
    """
    try:
        result = TraceService.import_trace(db=db, payload=payload, overwrite=overwrite)
        if run_detect and result.status == "imported":
            try:
                DetectionEngine.run_detection(db=db, trace_id=result.trace_id)
            except Exception as det_err:
                print(f"[!] Warning: Auto-detection failed on import: {det_err}")
        return result
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(val_err))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to ingest trace: {str(e)}",
        )


@router.post("/traces/upload", response_model=TraceImportResponse, status_code=status.HTTP_201_CREATED, tags=["Traces"])
async def upload_trace_file(
    file: UploadFile = File(...),
    overwrite: bool = Query(False),
    run_detect: bool = Query(True),
    db: Session = Depends(get_db),
):
    """Upload a raw JSON trace file from the UI or command line."""
    if not file.filename.endswith(".json"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file must be a .json file")

    content = await file.read()
    if len(content) > settings.MAX_IMPORT_PAYLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size ({settings.MAX_IMPORT_PAYLOAD_BYTES} bytes)",
        )

    try:
        data = json.loads(content.decode("utf-8"))
        payload = TraceImportPayload.model_validate(data)
        result = TraceService.import_trace(db=db, payload=payload, overwrite=overwrite)
        if run_detect and result.status == "imported":
            try:
                DetectionEngine.run_detection(db=db, trace_id=result.trace_id)
            except Exception as det_err:
                print(f"[!] Warning: Auto-detection failed on upload: {det_err}")
        return result
    except json.JSONDecodeError as jde:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid JSON format: {str(jde)}")
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Import failed: {str(e)}")


@router.get("/traces/{trace_id}", response_model=TraceDetailResponse, tags=["Traces"])
def get_trace(trace_id: str, db: Session = Depends(get_db)):
    """Fetch complete trace metadata including full ordered execution spans."""
    detail = TraceService.get_trace_detail(db=db, trace_id=trace_id)
    if not detail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Trace '{trace_id}' not found")
    inc_count = db.query(func.count(Incident.id)).filter(Incident.trace_id == trace_id).scalar() or 0
    d_dict = detail.model_dump()
    d_dict["incident_count"] = inc_count
    return TraceDetailResponse(**d_dict)


@router.get("/traces/{trace_id}/spans", response_model=List[SpanResponse], tags=["Traces"])
def get_trace_spans(trace_id: str, db: Session = Depends(get_db)):
    """Fetch all execution spans for a given trace."""
    trace = db.query(Trace).filter(Trace.id == trace_id).first()
    if not trace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Trace '{trace_id}' not found")
    return TraceService.get_trace_spans(db=db, trace_id=trace_id)


# ==========================================
# Phase 2: Incidents & Detections
# ==========================================

@router.post("/traces/{trace_id}/detect", response_model=List[IncidentResponse], tags=["Detection Engine"])
def run_trace_detection(trace_id: str, db: Session = Depends(get_db)):
    """
    Execute all deterministic detection rules against the specified trace.
    Correlates findings into incidents and returns persisted incident records.
    """
    trace = db.query(Trace).filter(Trace.id == trace_id).first()
    if not trace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Trace '{trace_id}' not found")

    try:
        incidents = DetectionEngine.run_detection(db=db, trace_id=trace_id)
        # Format response
        res = []
        for inc in incidents:
            project = db.query(Project).filter(Project.id == trace.project_id).first()
            agent = db.query(Agent).filter(Agent.id == trace.agent_id).first()
            det_count = len(inc.detections)
            res.append(
                IncidentResponse(
                    id=inc.id,
                    trace_id=inc.trace_id,
                    title=inc.title,
                    description=inc.description,
                    severity=inc.severity,
                    status=inc.status,
                    first_suspicious_event_id=inc.first_suspicious_event_id,
                    created_at=inc.created_at,
                    updated_at=inc.updated_at,
                    project_name=project.name if project else "Unknown",
                    agent_name=agent.name if agent else "Unknown",
                    detection_count=det_count,
                )
            )
        return res
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Detection execution failed: {str(e)}",
        )


@router.get("/traces/{trace_id}/detections", response_model=List[DetectionResponse], tags=["Detection Engine"])
def get_trace_detections(trace_id: str, db: Session = Depends(get_db)):
    """Fetch all raw detections and supporting evidence for a given trace."""
    trace = db.query(Trace).filter(Trace.id == trace_id).first()
    if not trace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Trace '{trace_id}' not found")

    detections = (
        db.query(Detection)
        .filter(Detection.trace_id == trace_id)
        .order_by(Detection.created_at.asc())
        .all()
    )
    return detections


@router.get("/incidents", response_model=List[IncidentResponse], tags=["Incidents"])
def list_incidents(
    severity: Optional[str] = Query(None, description="Filter by severity (Critical, High, Medium, Low)"),
    status: Optional[str] = Query(None, description="Filter by status (Open, Resolved, Investigating)"),
    project_id: Optional[str] = Query(None),
    rule_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None, description="Search by title, description, trace, or agent"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    order_by: str = Query("created_at"),
    descending: bool = Query(True),
    db: Session = Depends(get_db),
):
    """List correlated incidents with severity filtering, agent/project metadata, and search."""
    query = (
        db.query(
            Incident,
            Project.name.label("project_name"),
            Agent.name.label("agent_name"),
            func.count(Detection.id).label("detection_count"),
        )
        .join(Trace, Incident.trace_id == Trace.id)
        .join(Project, Trace.project_id == Project.id)
        .join(Agent, Trace.agent_id == Agent.id)
        .outerjoin(Detection, Incident.id == Detection.incident_id)
        .group_by(Incident.id, Project.name, Agent.name)
    )

    if severity and severity.lower() != "all":
        query = query.filter(Incident.severity == normalize_severity(severity))

    if status and status.lower() != "all":
        query = query.filter(Incident.status.ilike(status))

    if project_id:
        query = query.filter(Trace.project_id == project_id)

    if rule_id:
        query = query.filter(Detection.rule_id == rule_id)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (Incident.title.ilike(search_pattern))
            | (Incident.description.ilike(search_pattern))
            | (Incident.id.ilike(search_pattern))
            | (Agent.name.ilike(search_pattern))
            | (Project.name.ilike(search_pattern))
        )

    order_col = Incident.created_at
    if order_by == "severity":
        order_col = Incident.severity
    elif order_by == "updated_at":
        order_col = Incident.updated_at

    query = query.order_by(sql_desc(order_col) if descending else sql_asc(order_col))
    results = query.offset(offset).limit(limit).all()

    incidents = []
    for inc, proj_name, agent_name, det_count in results:
        incidents.append(
            IncidentResponse(
                id=inc.id,
                trace_id=inc.trace_id,
                title=inc.title,
                description=inc.description,
                severity=inc.severity,
                status=inc.status,
                first_suspicious_event_id=inc.first_suspicious_event_id,
                created_at=inc.created_at,
                updated_at=inc.updated_at,
                project_name=proj_name,
                agent_name=agent_name,
                detection_count=det_count,
            )
        )
    return incidents


@router.get("/incidents/{incident_id}", response_model=IncidentDetailResponse, tags=["Incidents"])
def get_incident(incident_id: str, db: Session = Depends(get_db)):
    """Fetch complete incident record with rule-based detections and cited trace evidence."""
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Incident '{incident_id}' not found")

    trace = db.query(Trace).filter(Trace.id == inc.trace_id).first()
    project = db.query(Project).filter(Project.id == trace.project_id).first() if trace else None
    agent = db.query(Agent).filter(Agent.id == trace.agent_id).first() if trace else None

    # Load detections with evidence
    detections = (
        db.query(Detection)
        .filter(Detection.incident_id == incident_id)
        .order_by(Detection.created_at.asc())
        .all()
    )

    return IncidentDetailResponse(
        id=inc.id,
        trace_id=inc.trace_id,
        title=inc.title,
        description=inc.description,
        severity=inc.severity,
        status=inc.status,
        first_suspicious_event_id=inc.first_suspicious_event_id,
        created_at=inc.created_at,
        updated_at=inc.updated_at,
        agent_id=agent.id if agent else "",
        agent_name=agent.name if agent else "Unknown Agent",
        agent_framework=agent.framework if agent else None,
        project_id=project.id if project else "",
        project_name=project.name if project else "Unknown Project",
        trace_objective=trace.objective if trace else "No objective available",
        detections=detections,
    )


@router.get("/incidents/{incident_id}/evidence", response_model=List[EvidenceReferenceResponse], tags=["Incidents"])
def get_incident_evidence(incident_id: str, db: Session = Depends(get_db)):
    """Fetch all evidence references across all detections in an incident."""
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Incident '{incident_id}' not found")

    evidence = (
        db.query(EvidenceReference)
        .join(Detection, EvidenceReference.detection_id == Detection.id)
        .filter(Detection.incident_id == incident_id)
        .all()
    )
    return evidence


@router.get("/detection-rules", response_model=List[DetectionRuleResponse], tags=["Detection Engine"])
def list_detection_rules():
    """List all registered deterministic detection rules and their default severities."""
    return [
        DetectionRuleResponse(
            rule_id=r.rule_id,
            name=r.name,
            description=r.description,
            default_severity=r.default_severity,
        )
        for r in registry.list_rules()
    ]


@router.get("/detection/summary", response_model=DetectionSummaryResponse, tags=["Detection Engine"])
def get_detection_summary(db: Session = Depends(get_db)):
    """Return aggregated incident and severity counts derived from persisted findings."""
    metrics = DetectionEngine.get_summary(db)
    return DetectionSummaryResponse(**metrics)


# ==========================================
# Phase 3: Investigation Workspace
# ==========================================

@router.get("/traces/{trace_id}/graph", response_model=ExecutionGraphResponse, tags=["Investigation"])
def get_execution_graph(trace_id: str, db: Session = Depends(get_db)):
    """Generate execution graph nodes and semantic edges for a trace."""
    try:
        return InvestigationService.build_execution_graph(db=db, trace_id=trace_id)
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(val_err))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to build execution graph: {str(e)}",
        )


@router.get("/traces/{trace_id}/investigation-context", response_model=InvestigationContextResponse, tags=["Investigation"])
def get_investigation_context(trace_id: str, db: Session = Depends(get_db)):
    """Fetch complete investigation context including intent vs execution comparison and incidents."""
    try:
        return InvestigationService.get_investigation_context(db=db, trace_id=trace_id)
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(val_err))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch investigation context: {str(e)}",
        )


@router.get("/traces/{trace_id}/events/{event_id}", response_model=EventDetailResponse, tags=["Investigation"])
def get_trace_event_detail(trace_id: str, event_id: str, db: Session = Depends(get_db)):
    """Fetch detailed event telemetry with ancestor hierarchy, children, and cited detections."""
    try:
        return InvestigationService.get_event_detail(db=db, trace_id=trace_id, event_id=event_id)
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(val_err))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch event detail: {str(e)}",
        )


# ==========================================
# Projects & Agents
# ==========================================

@router.get("/projects", response_model=List[ProjectResponse], tags=["Projects"])
def list_projects(db: Session = Depends(get_db)):
    """List all registered projects."""
    return db.query(Project).order_by(Project.name.asc()).all()


@router.get("/agents", response_model=List[AgentResponse], tags=["Agents"])
def list_agents(db: Session = Depends(get_db)):
    """List all registered AI agents."""
    return db.query(Agent).order_by(Agent.name.asc()).all()


# ==========================================
# Phase 4: Gemma AI Incident Investigation
# ==========================================

@router.post("/incidents/{incident_id}/investigate", response_model=InvestigationResponse, tags=["AI Investigation"])
async def start_investigation(incident_id: str, db: Session = Depends(get_db)):
    """
    Trigger a Gemma-powered investigation job for the specified incident.
    Validates model availability before enqueuing.
    """
    # 1. Verify incident exists
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident '{incident_id}' not found.",
        )

    # 2. Check model health status
    health = await ModelHealthService.get_health_status()
    if health.get("status") != "ready":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": "MODEL_UNAVAILABLE",
                "status": health.get("status"),
                "message": health.get("message"),
                "setup_instructions": health.get("setup_instructions"),
            },
        )

    # 3. Create and enqueue investigation job
    try:
        investigation = await InvestigationJobManager.create_and_enqueue_investigation(
            db=db, incident_id=incident_id
        )
        return investigation
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to enqueue investigation: {str(e)}",
        )


@router.get("/incidents/{incident_id}/investigations", response_model=List[InvestigationResponse], tags=["AI Investigation"])
def get_incident_investigations(incident_id: str, db: Session = Depends(get_db)):
    """List all investigations associated with the specified incident."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident '{incident_id}' not found.",
        )

    return (
        db.query(Investigation)
        .filter(Investigation.incident_id == incident_id)
        .order_by(Investigation.created_at.desc())
        .all()
    )


@router.get("/investigations/{investigation_id}", response_model=InvestigationDetailResponse, tags=["AI Investigation"])
def get_investigation_detail(investigation_id: str, db: Session = Depends(get_db)):
    """Fetch complete investigation record including hypotheses, evidence items, and remediation suggestions."""
    investigation = db.query(Investigation).filter(Investigation.id == investigation_id).first()
    if not investigation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Investigation '{investigation_id}' not found.",
        )

    hypotheses = (
        db.query(Hypothesis)
        .filter(Hypothesis.investigation_id == investigation_id)
        .order_by(Hypothesis.rank.asc())
        .all()
    )
    evidence_items = (
        db.query(InvestigationEvidence)
        .filter(InvestigationEvidence.investigation_id == investigation_id)
        .all()
    )
    remediation_suggestions = (
        db.query(RemediationSuggestion)
        .filter(RemediationSuggestion.investigation_id == investigation_id)
        .all()
    )

    incident = db.query(Incident).filter(Incident.id == investigation.incident_id).first()
    trace = db.query(Trace).filter(Trace.id == investigation.trace_id).first()

    # Map evidence items to each hypothesis
    evidence_by_hyp = {}
    for ev in evidence_items:
        evidence_by_hyp.setdefault(ev.hypothesis_id, []).append(ev)

    hyp_responses = []
    for hyp in hypotheses:
        hyp_dict = {
            "id": hyp.id,
            "investigation_id": hyp.investigation_id,
            "title": hyp.title,
            "explanation": hyp.explanation,
            "confidence_level": hyp.confidence_level,
            "verification_status": hyp.verification_status,
            "suggested_check": hyp.suggested_check,
            "rank": hyp.rank,
            "missing_evidence": hyp.missing_evidence or [],
            "evidence": [
                InvestigationEvidenceResponse.model_validate(e)
                for e in evidence_by_hyp.get(hyp.id, [])
            ],
        }
        hyp_responses.append(HypothesisResponse(**hyp_dict))

    trace_summary = None
    if trace:
        trace_summary = TraceSummaryResponse(
            id=trace.id,
            project_id=trace.project_id,
            project_name=trace.project.name if trace.project else "Default",
            agent_id=trace.agent_id,
            agent_name=trace.agent.name if trace.agent else "Default Agent",
            objective=trace.objective,
            status=trace.status,
            started_at=trace.started_at,
            ended_at=trace.ended_at,
            duration_ms=(
                max(0.0, (trace.ended_at - trace.started_at).total_seconds() * 1000)
                if trace.ended_at and trace.started_at
                else None
            ),
            span_count=len(trace.spans) if trace.spans else 0,
            incident_count=len(trace.incidents) if trace.incidents else 0,
            created_at=trace.created_at,
        )

    incident_resp = None
    if incident:
        proj_name = trace.project.name if trace and trace.project else "Unknown"
        ag_name = trace.agent.name if trace and trace.agent else "Unknown"
        det_cnt = len(incident.detections) if incident.detections else 0
        incident_resp = IncidentResponse(
            id=incident.id,
            trace_id=incident.trace_id,
            title=incident.title,
            description=incident.description,
            severity=incident.severity,
            status=incident.status,
            first_suspicious_event_id=incident.first_suspicious_event_id,
            created_at=incident.created_at,
            updated_at=incident.updated_at,
            project_name=proj_name,
            agent_name=ag_name,
            detection_count=det_cnt,
        )

    return InvestigationDetailResponse(
        id=investigation.id,
        incident_id=investigation.incident_id,
        trace_id=investigation.trace_id,
        status=investigation.status,
        model_name=investigation.model_name,
        prompt_version=investigation.prompt_version,
        started_at=investigation.started_at,
        completed_at=investigation.completed_at,
        duration_ms=investigation.duration_ms,
        failure_code=investigation.failure_code,
        failure_message=investigation.failure_message,
        created_at=investigation.created_at,
        summary=investigation.summary,
        observed_failure=investigation.observed_failure,
        first_suspicious_event_id=investigation.first_suspicious_event_id,
        conclusion_status=investigation.conclusion_status,
        evidence_count=investigation.evidence_count,
        is_truncated=investigation.is_truncated,
        hypotheses=hyp_responses,
        evidence_items=[InvestigationEvidenceResponse.model_validate(e) for e in evidence_items],
        remediation_suggestions=[RemediationResponse.model_validate(r) for r in remediation_suggestions],
        incident=incident_resp,
        trace=trace_summary,
    )


@router.get("/investigations/{investigation_id}/status", response_model=InvestigationStatusResponse, tags=["AI Investigation"])
def get_investigation_status(investigation_id: str, db: Session = Depends(get_db)):
    """Lightweight polling endpoint to check status and progress of an active investigation."""
    inv = db.query(Investigation).filter(Investigation.id == investigation_id).first()
    if not inv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Investigation '{investigation_id}' not found.",
        )
    return InvestigationStatusResponse(
        id=inv.id,
        incident_id=inv.incident_id,
        status=inv.status,
        duration_ms=inv.duration_ms,
        failure_code=inv.failure_code,
        failure_message=inv.failure_message,
        started_at=inv.started_at,
        completed_at=inv.completed_at,
    )


@router.get("/investigations/{investigation_id}/evidence", response_model=List[InvestigationEvidenceResponse], tags=["AI Investigation"])
def get_investigation_evidence(investigation_id: str, db: Session = Depends(get_db)):
    """Fetch all verified telemetry event evidence records linked to this investigation."""
    inv = db.query(Investigation).filter(Investigation.id == investigation_id).first()
    if not inv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Investigation '{investigation_id}' not found.",
        )
    return (
        db.query(InvestigationEvidence)
        .filter(InvestigationEvidence.investigation_id == investigation_id)
        .all()
    )


# ==========================================
# System Diagnostics & Live Health Probes
# ==========================================

@router.get("/system/diagnostics", response_model=SystemDiagnosticsResponse, tags=["System"])
async def get_system_diagnostics(db: Session = Depends(get_db)):
    """
    Execute live diagnostic probes across all six core platform subsystems:
    1. API Server
    2. SQLite Database
    3. Ollama Service
    4. Google Gemma Model
    5. Docker Replay Worker
    6. Report Generation Engine
    """
    checks: List[DiagnosticCheckItem] = []
    overall_status = "operational"

    # 1. API Server Check
    t0 = time.time()
    api_latency = round((time.time() - t0) * 1000, 2)
    checks.append(DiagnosticCheckItem(
        name="FastAPI Server",
        subsystem="api",
        status="operational",
        latency_ms=api_latency,
        details={
            "python_version": sys.version.split()[0],
            "framework": "FastAPI",
            "cors_origins": ["http://localhost:5173", "http://127.0.0.1:5173"],
            "pid": os.getpid(),
        },
        message="FastAPI backend is responsive and processing requests.",
    ))

    # 2. Database (SQLite) Check
    t0 = time.time()
    try:
        total_traces = db.query(Trace).count()
        total_incidents = db.query(Incident).count()
        db_latency = round((time.time() - t0) * 1000, 2)
        checks.append(DiagnosticCheckItem(
            name="SQLite Database",
            subsystem="database",
            status="operational",
            latency_ms=db_latency,
            details={
                "traces_count": total_traces,
                "incidents_count": total_incidents,
                "schema_version": "v1.0-phase5",
            },
            message=f"SQLite database is online with {total_traces} trace(s) and {total_incidents} incident(s).",
        ))
    except Exception as e:
        overall_status = "failed"
        checks.append(DiagnosticCheckItem(
            name="SQLite Database",
            subsystem="database",
            status="failed",
            message=f"Database query error: {str(e)}",
            actionable_remediation="Check SQLite database permissions at apps/api/rift.db.",
        ))

    # 3. Ollama Service Check
    t0 = time.time()
    health = await ModelHealthService.get_health_status()
    ollama_latency = round((time.time() - t0) * 1000, 2)
    ollama_ok = health.get("status") in ("ready", "connected")
    if ollama_ok:
        checks.append(DiagnosticCheckItem(
            name="Ollama Service",
            subsystem="ollama",
            status="operational",
            latency_ms=ollama_latency,
            details={
                "version": health.get("ollama_version"),
                "base_url": settings.OLLAMA_BASE_URL,
                "provider": settings.RIFT_INFERENCE_PROVIDER,
            },
            message=f"Connected to Ollama v{health.get('ollama_version')} on {settings.OLLAMA_BASE_URL}.",
        ))
    else:
        if overall_status != "failed":
            overall_status = "degraded"
        checks.append(DiagnosticCheckItem(
            name="Ollama Service",
            subsystem="ollama",
            status="failed",
            latency_ms=ollama_latency,
            details={"base_url": settings.OLLAMA_BASE_URL},
            message=health.get("message", "Ollama daemon unreachable."),
            actionable_remediation=health.get("setup_instructions") or "Start Ollama via `brew services start ollama` or `ollama serve`.",
        ))

    # 4. Google Gemma Model Check
    available_models = health.get("available_models", [])
    model_installed = any(
        m == settings.GEMMA_MODEL or m.startswith(f"{settings.GEMMA_MODEL}:") or settings.GEMMA_MODEL.startswith(f"{m}:")
        for m in available_models
    )
    if model_installed:
        checks.append(DiagnosticCheckItem(
            name=f"Gemma Model ({settings.GEMMA_MODEL})",
            subsystem="gemma",
            status="operational",
            details={
                "configured_model": settings.GEMMA_MODEL,
                "installed_models": available_models,
                "parameter_size": "Effective 2B",
                "max_concurrency": settings.GEMMA_MAX_CONCURRENT_REQUESTS,
            },
            message=f"Model '{settings.GEMMA_MODEL}' is downloaded and ready for local inference.",
        ))
    else:
        if overall_status != "failed":
            overall_status = "degraded"
        checks.append(DiagnosticCheckItem(
            name=f"Gemma Model ({settings.GEMMA_MODEL})",
            subsystem="gemma",
            status="degraded",
            details={"configured_model": settings.GEMMA_MODEL, "installed_models": available_models},
            message=f"Model '{settings.GEMMA_MODEL}' is not installed.",
            actionable_remediation=f"Run `ollama pull {settings.GEMMA_MODEL}` to download model weights.",
        ))

    # 5. Docker Replay Worker Check
    from app.services.replay.sandbox import SandboxOrchestrator
    caps = SandboxOrchestrator.get_capabilities()
    if caps.get("available", False):
        checks.append(DiagnosticCheckItem(
            name="Docker Replay Worker",
            subsystem="replay",
            status="operational",
            details={"runtime": caps.get("runtime", "docker"), "image": "rift-replay-worker:latest"},
            message="Isolated Docker sandbox replay worker is online.",
        ))
    else:
        checks.append(DiagnosticCheckItem(
            name="Docker Replay Worker",
            subsystem="replay",
            status="disabled",
            details={"runtime": "none", "no_host_execution": True},
            message=caps.get("message", "Secure replay unavailable."),
            actionable_remediation=caps.get("reason", "Docker daemon is not running."),
        ))

    # 6. Report Generation Engine Check
    total_invs = db.query(Investigation).filter(Investigation.status == "completed").count()
    checks.append(DiagnosticCheckItem(
        name="Report Generation Engine",
        subsystem="reports",
        status="operational",
        details={
            "supported_formats": ["markdown", "json"],
            "completed_investigations": total_invs,
            "export_ready": True,
        },
        message=f"Report engine ready; {total_invs} completed investigation report(s) available for export.",
    ))

    hw_summary = ModelHealthService.get_hardware_info()

    return SystemDiagnosticsResponse(
        overall_status=overall_status,
        timestamp=datetime.now(timezone.utc),
        checks=checks,
        hardware_summary=hw_summary,
    )


# ==========================================
# Phase 6 & Investigation Reports
# ==========================================

@router.get("/reports", response_model=List[ReportItemResponse], tags=["Reports"])
def list_reports(db: Session = Depends(get_db)):
    """List all incident investigations available for technical report export."""
    investigations = (
        db.query(Investigation)
        .order_by(Investigation.created_at.desc())
        .all()
    )

    from app.models.models import Replay
    results: List[ReportItemResponse] = []
    for inv in investigations:
        incident = db.query(Incident).filter(Incident.id == inv.incident_id).first()
        if not incident:
            continue
        has_replay = (
            db.query(Replay)
            .filter(Replay.investigation_id == inv.id, Replay.status == "completed")
            .first()
            is not None
        )
        results.append(ReportItemResponse(
            investigation_id=inv.id,
            incident_id=incident.id,
            trace_id=inv.trace_id,
            title=incident.title,
            severity=incident.severity,
            status=inv.status,
            conclusion_status=inv.conclusion_status,
            model_name=inv.model_name,
            duration_ms=inv.duration_ms,
            created_at=inv.created_at,
            evidence_count=inv.evidence_count,
            has_replay=has_replay,
            markdown_url=f"/api/reports/{inv.id}/export?format=markdown",
            json_url=f"/api/reports/{inv.id}/export?format=json",
        ))
    return results


@router.get("/reports/{investigation_id}/export", tags=["Reports"])
def export_investigation_report(
    investigation_id: str,
    format: str = Query(default="markdown", pattern="^(markdown|json)$"),
    db: Session = Depends(get_db),
):
    """
    Export verified incident investigation report in GitHub-flavored Markdown or structured JSON.
    Grounds all analysis strictly in trace telemetry and attributes Gemma causal findings.
    """
    inv = db.query(Investigation).filter(Investigation.id == investigation_id).first()
    if not inv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Investigation '{investigation_id}' not found.",
        )

    incident = db.query(Incident).filter(Incident.id == inv.incident_id).first()
    trace = db.query(Trace).filter(Trace.id == inv.trace_id).first() if incident else None

    # Load replay data if any
    from app.models.models import Replay, ReplayComparison
    replay = (
        db.query(Replay)
        .filter(Replay.investigation_id == inv.id, Replay.status == "completed")
        .first()
    )
    comparison = (
        db.query(ReplayComparison).filter(ReplayComparison.replay_id == replay.id).first()
        if replay
        else None
    )

    if format == "json":
        report_data = {
            "$schema": "https://rift.dev/schemas/investigation-report-v1.json",
            "report_id": f"rep-{inv.id}",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "attribution": {
                "engine": f"Google Gemma ({inv.model_name})",
                "provider": "Local Ollama" if settings.RIFT_INFERENCE_PROVIDER == "local" else "Ollama Cloud",
                "prompt_version": inv.prompt_version,
                "system_notice": (
                    "Model-generated causal analysis grounded in verified execution telemetry. "
                    "Citations verified against immutable trace spans."
                ),
            },
            "incident": {
                "id": incident.id if incident else None,
                "trace_id": incident.trace_id if incident else None,
                "title": incident.title if incident else "Unknown Incident",
                "severity": incident.severity if incident else "Medium",
                "status": incident.status if incident else "Open",
                "first_suspicious_event_id": incident.first_suspicious_event_id if incident else None,
                "agent_name": trace.agent.name if (trace and trace.agent) else "Agent",
                "project_name": trace.project.name if (trace and trace.project) else "Project",
            },
            "trace": {
                "id": trace.id if trace else None,
                "objective": trace.objective if trace else None,
                "status": trace.status if trace else None,
                "span_count": len(trace.spans) if (trace and trace.spans) else 0,
                "duration_ms": (
                    (trace.ended_at - trace.started_at).total_seconds() * 1000
                    if (trace and trace.ended_at and trace.started_at)
                    else None
                ),
            },
            "gemma_investigation": {
                "id": inv.id,
                "status": inv.status,
                "conclusion_status": inv.conclusion_status,
                "inference_duration_ms": inv.duration_ms,
                "summary": inv.summary,
                "observed_failure": inv.observed_failure,
                "hypotheses": [
                    {
                        "rank": h.rank,
                        "title": h.title,
                        "explanation": h.explanation,
                        "confidence_level": h.confidence_level,
                        "verification_status": h.verification_status,
                        "suggested_check": h.suggested_check,
                        "missing_evidence": h.missing_evidence,
                        "citations": [
                            {
                                "event_id": e.event_id,
                                "relationship": e.relationship,
                                "explanation": e.explanation,
                            }
                            for e in h.evidence
                        ],
                    }
                    for h in inv.hypotheses
                ],
                "remediations": [
                    {
                        "description": r.description,
                        "rationale": r.rationale,
                        "risk_level": r.risk_level,
                        "requires_human_approval": r.requires_human_approval,
                        "verification_method": r.verification_method,
                    }
                    for r in inv.remediations
                ],
            },
            "counterfactual_replay": {
                "replay_id": replay.id,
                "verdict": comparison.verdict if comparison else None,
                "conclusion": comparison.conclusion if comparison else None,
                "original_outcome": comparison.original_outcome if comparison else None,
                "counterfactual_outcome": comparison.counterfactual_outcome if comparison else None,
            }
            if replay and comparison
            else None,
        }
        return JSONResponse(
            content=report_data,
            headers={
                "Content-Disposition": f'attachment; filename="rift-investigation-{inv.id}.json"'
            },
        )

    # Markdown export
    hypotheses_md = ""
    for idx, h in enumerate(inv.hypotheses, 1):
        sup_events = [e.event_id for e in h.evidence if e.relationship == "supporting"]
        con_events = [e.event_id for e in h.evidence if e.relationship == "contradicting"]
        hypotheses_md += f"""### Hypothesis {idx}: {h.title}
- **Confidence:** {h.confidence_level.upper()}
- **Verification Status:** {h.verification_status.upper()}
- **Technical Explanation:** {h.explanation}
- **Supporting Telemetry Citations:** {', '.join(sup_events) if sup_events else 'None'}
- **Contradicting Telemetry Citations:** {', '.join(con_events) if con_events else 'None'}
- **Missing Information / Signals:** {'; '.join(h.missing_evidence) if h.missing_evidence else 'None'}
- **Recommended Verification:** {h.suggested_check or 'N/A'}

"""

    remediations_md = ""
    for idx, r in enumerate(inv.remediations, 1):
        remediations_md += f"""### Remediation {idx}: {r.description}
- **Risk Level:** {r.risk_level.upper()}
- **Requires Human Approval:** {'YES' if r.requires_human_approval else 'NO'}
- **Rationale:** {r.rationale or 'N/A'}
- **Verification Method:** {r.verification_method or 'N/A'}

"""

    replay_md = ""
    if replay and comparison:
        replay_md = f"""## 4. Counterfactual Sandbox Replay
- **Replay ID:** `{replay.id}`
- **Verdict:** {comparison.verdict}
- **Conclusion:** {comparison.conclusion}
- **Original Action Outcome:** {comparison.original_outcome}
- **Alternative Action Outcome:** {comparison.counterfactual_outcome}
"""

    md_content = f"""# RIFT Incident Investigation Report
**Generated by Google Gemma ({inv.model_name}) via Ollama**
- **Investigation ID:** `{inv.id}`
- **Incident ID:** `{inv.incident_id}`
- **Trace ID:** `{inv.trace_id}`
- **Investigation Status:** {inv.status.upper()} ({inv.conclusion_status or 'N/A'})
- **Inference Latency:** {f'{inv.duration_ms:.2f}ms' if inv.duration_ms else 'N/A'}
- **Prompt Version:** {inv.prompt_version}
- **Generated At:** {inv.created_at.strftime('%Y-%m-%d %H:%M:%S UTC')}

---

## 1. Executive Summary
{inv.summary or 'No summary provided.'}

### Observed Failure
{inv.observed_failure or 'N/A'}

### First Suspicious Telemetry Event
`{inv.first_suspicious_event_id or 'None identified'}`

---

## 2. Grounded Causal Hypotheses
{hypotheses_md or 'No hypotheses generated.'}

---

## 3. Recommended Architectural & Programmatic Remediations
*(Informational for human engineering review; not automatically executed on host.)*

{remediations_md or 'No remediations proposed.'}

---
{replay_md}
---
*Notice: This report was generated by Google Gemma ({inv.model_name}) based on immutable execution telemetry imported into RIFT. Causal findings are model-inferred analyses, not physical assertions.*
"""
    return PlainTextResponse(
        content=md_content,
        media_type="text/markdown",
        headers={
            "Content-Disposition": f'attachment; filename="rift-investigation-{inv.id}.md"'
        },
    )


# ==========================================
# Codebase Knowledge (Graphify) Endpoints
# ==========================================

@router.get("/knowledge/status", response_model=CodeKnowledgeStatusResponse, tags=["Code Knowledge"])
def get_codebase_knowledge_status():
    return code_knowledge_service.get_status()


@router.get("/knowledge/graph", response_model=CodeKnowledgeGraphResponse, tags=["Code Knowledge"])
def get_codebase_knowledge_graph(
    community: Optional[int] = Query(None, description="Filter by Louvain community ID"),
    search: Optional[str] = Query(None, description="Search term across labels, symbols, and files"),
    focus_file: Optional[str] = Query(None, description="Focus on a specific source file path"),
    focus_node: Optional[str] = Query(None, description="Focus on a specific symbol or node ID"),
    node_type: Optional[str] = Query(None, description="Filter by node type: class, func, code, document, concept"),
    relation_type: Optional[str] = Query(None, description="Filter by relation type: calls, imports, uses, inherits, contains"),
    confidence: Optional[str] = Query(None, description="Filter by confidence: EXTRACTED, INFERRED"),
    max_nodes: int = Query(150, ge=20, le=400, description="Maximum visible nodes in force graph"),
    depth: int = Query(1, ge=1, le=3, description="Neighborhood expansion hop depth"),
):
    """
    Returns an interactive, bounded knowledge graph with real AST nodes,
    edges, Louvain community clusters, and exact source provenance.
    """
    return code_knowledge_service.get_graph(
        community=community,
        search=search,
        focus_file=focus_file,
        focus_node=focus_node,
        node_type=node_type,
        relation_type=relation_type,
        confidence=confidence,
        max_nodes=max_nodes,
        depth=depth,
    )


@router.get("/knowledge/communities", response_model=List[CodeCommunitySummary], tags=["Code Knowledge"])
def get_codebase_knowledge_communities():
    """Returns all detected Louvain modularity communities with top hub symbols."""
    return code_knowledge_service.get_communities()


@router.post("/knowledge/query", response_model=CodeKnowledgeQueryResponse, tags=["Code Knowledge"])
def query_codebase_knowledge(payload: CodeKnowledgeQueryRequest):
    return code_knowledge_service.query(payload.query, seed=payload.seed, budget=payload.budget)


@router.get("/knowledge/explain/{symbol}", response_model=CodeKnowledgeExplainResponse, tags=["Code Knowledge"])
def explain_codebase_knowledge(symbol: str):
    return code_knowledge_service.explain(symbol)


@router.post("/knowledge/refresh", response_model=CodeKnowledgeRefreshResponse, tags=["Code Knowledge"])
def refresh_codebase_knowledge():
    return code_knowledge_service.refresh_graph()


@router.get("/knowledge/file-preview", response_model=FilePreviewResponse, tags=["Code Knowledge"])
def preview_source_file(
    path: str = Query(..., description="Repository relative file path"),
    line: Optional[int] = Query(None, description="Optional target line number"),
    context: int = Query(25, ge=5, le=100, description="Lines of context around target line"),
):
    try:
        return code_knowledge_service.preview_file(path, line_number=line, context_lines=context)
    except PermissionError as pe:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(pe))
    except FileNotFoundError as fe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(fe))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/knowledge/impact", response_model=CodeImpactResponse, tags=["Code Knowledge"])
def analyze_code_impact(payload: CodeImpactRequest):
    try:
        return code_knowledge_service.analyze_impact(
            target=payload.target,
            change_type=payload.change_type or "modify",
            max_depth=payload.max_depth,
            max_results=payload.max_results,
        )
    except PermissionError as pe:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(pe))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/knowledge/impact", response_model=CodeImpactResponse, tags=["Code Knowledge"])
def get_code_impact(
    target: str = Query(..., min_length=1, max_length=500, description="File path or symbol"),
    change_type: str = Query("modify", description="Type of change (modify, delete, create)"),
    depth: int = Query(2, ge=1, le=5, description="Max depth of dependency traversal"),
    limit: int = Query(50, ge=1, le=200, description="Max relationships to return"),
):
    try:
        return code_knowledge_service.analyze_impact(
            target=target,
            change_type=change_type,
            max_depth=depth,
            max_results=limit,
        )
    except PermissionError as pe:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(pe))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/incidents/{incident_id}/code-impact", response_model=IncidentCodeImpactResponse, tags=["Incidents", "Code Knowledge"])
def get_incident_code_impact(incident_id: str, db: Session = Depends(get_db)):
    try:
        return code_knowledge_service.get_incident_impact(incident_id, db)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
    except PermissionError as pe:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(pe))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.get("/traces/{trace_id}/code-impact", response_model=TraceCodeImpactResponse, tags=["Traces", "Code Knowledge"])
def get_trace_code_impact(trace_id: str, db: Session = Depends(get_db)):
    """
    Extracts all file operations from an agent trace's spans and analyzes
    codebase dependency blast radiuses and discovered test suites.
    """
    try:
        return code_knowledge_service.get_trace_impact(trace_id, db)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
    except PermissionError as pe:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(pe))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.get("/spans/{span_id}/code-impact", response_model=CodeImpactResponse, tags=["Traces", "Code Knowledge"])
def get_span_code_impact(span_id: str, db: Session = Depends(get_db)):
    """
    Analyzes code impact for a specific trace span if it is a file creation,
    modification, or deletion event.
    """
    try:
        return code_knowledge_service.get_span_impact(span_id, db)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
    except PermissionError as pe:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(pe))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.post("/knowledge/validate-impact", response_model=ValidationRunResult, tags=["Code Knowledge"])
def run_test_validation(payload: ValidationRunRequest):
    """
    Safely executes an approved, verified test suite in an isolated environment.
    Requires explicit user confirmation (confirm=True).
    Guaranteed shell=False, strict whitelisted test directories, and timeout limits.
    """
    try:
        return code_knowledge_service.execute_test_validation(
            test_id=payload.test_id,
            confirm=payload.confirm,
            compare_baseline=payload.compare_baseline,
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except FileNotFoundError as fe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(fe))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


# Mount Replay Router
from app.api.routes.replays import router as replays_router
router.include_router(replays_router)


