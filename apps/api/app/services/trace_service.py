import uuid
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from app.models.models import Project, Agent, Trace, Span, Incident
from app.schemas.schemas import TraceImportPayload, TraceImportResponse, TraceSummaryResponse, TraceDetailResponse
from app.core.redactor import sanitize_payload


class TraceService:
    @staticmethod
    def import_trace(db: Session, payload: TraceImportPayload, overwrite: bool = False) -> TraceImportResponse:
        """
        Transactionally ingest an execution trace.
        Documented duplicate policy:
        If a trace with the same ID already exists:
        - If overwrite is False (default): return existing trace status 'already_exists' idempotently.
        - If overwrite is True: replace existing trace and child spans atomically.
        """
        existing_trace = db.query(Trace).filter(Trace.id == payload.trace.id).first()
        if existing_trace and not overwrite:
            span_count = db.query(func.count(Span.id)).filter(Span.trace_id == existing_trace.id).scalar() or 0
            return TraceImportResponse(
                trace_id=existing_trace.id,
                status="already_exists",
                span_count=span_count,
                message=f"Trace '{existing_trace.id}' already exists in database. Existing record preserved.",
            )

        try:
            # 1. Resolve or create Project
            project_id = payload.project.id or str(uuid.uuid4())
            project = db.query(Project).filter(
                (Project.id == project_id) | (Project.name == payload.project.name)
            ).first()

            if not project:
                project = Project(
                    id=project_id,
                    name=payload.project.name,
                    description=payload.project.description,
                )
                db.add(project)
                db.flush()
            elif payload.project.description and not project.description:
                project.description = payload.project.description
                db.flush()

            # 2. Resolve or create Agent
            agent_id = payload.agent.id or str(uuid.uuid4())
            agent = db.query(Agent).filter(
                (Agent.id == agent_id) | ((Agent.name == payload.agent.name) & (Agent.project_id == project.id))
            ).first()

            if not agent:
                agent = Agent(
                    id=agent_id,
                    project_id=project.id,
                    name=payload.agent.name,
                    framework=payload.agent.framework,
                )
                db.add(agent)
                db.flush()

            # 3. Handle overwrite if needed
            if existing_trace and overwrite:
                db.delete(existing_trace)
                db.flush()

            # 4. Create Trace
            trace = Trace(
                id=payload.trace.id,
                project_id=project.id,
                agent_id=agent.id,
                objective=payload.trace.objective,
                status=payload.trace.status,
                started_at=payload.trace.started_at,
                ended_at=payload.trace.ended_at,
            )
            db.add(trace)
            db.flush()

            # 5. Create Spans with sanitized/redacted data
            for span_in in payload.spans:
                # Sanitize payloads to redact credentials, tokens, passwords
                clean_input = sanitize_payload(span_in.input_data)
                clean_output = sanitize_payload(span_in.output_data)
                clean_error = sanitize_payload(span_in.error_data)
                clean_metadata = sanitize_payload(span_in.metadata)

                span = Span(
                    id=span_in.id,
                    trace_id=trace.id,
                    parent_span_id=span_in.parent_span_id,
                    event_type=span_in.event_type,
                    name=span_in.name,
                    timestamp=span_in.timestamp,
                    duration_ms=span_in.duration_ms,
                    status=span_in.status,
                    input_data=clean_input,
                    output_data=clean_output,
                    error_data=clean_error,
                    metadata_payload=clean_metadata,
                )
                db.add(span)

            db.commit()

            return TraceImportResponse(
                trace_id=trace.id,
                status="imported",
                span_count=len(payload.spans),
                message=f"Successfully imported trace '{trace.id}' with {len(payload.spans)} execution spans.",
            )
        except Exception as e:
            db.rollback()
            raise e

    @staticmethod
    def list_traces(
        db: Session,
        status: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[TraceSummaryResponse]:
        query = (
            db.query(
                Trace,
                Project.name.label("project_name"),
                Agent.name.label("agent_name"),
                func.count(Span.id).label("span_count"),
            )
            .join(Project, Trace.project_id == Project.id)
            .join(Agent, Trace.agent_id == Agent.id)
            .outerjoin(Span, Trace.id == Span.trace_id)
            .group_by(Trace.id, Project.name, Agent.name)
            .order_by(Trace.started_at.desc())
        )

        if status:
            query = query.filter(Trace.status == status)

        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                (Trace.objective.ilike(search_pattern))
                | (Project.name.ilike(search_pattern))
                | (Agent.name.ilike(search_pattern))
                | (Trace.id.ilike(search_pattern))
            )

        results = query.offset(offset).limit(limit).all()

        summaries = []
        for trace, proj_name, agent_name, count in results:
            duration = None
            if trace.ended_at and trace.started_at:
                duration = max(0.0, (trace.ended_at - trace.started_at).total_seconds() * 1000)

            inc_count = db.query(func.count(Incident.id)).filter(Incident.trace_id == trace.id).scalar() or 0

            summaries.append(
                TraceSummaryResponse(
                    id=trace.id,
                    project_id=trace.project_id,
                    project_name=proj_name,
                    agent_id=trace.agent_id,
                    agent_name=agent_name,
                    objective=trace.objective,
                    status=trace.status,
                    started_at=trace.started_at,
                    ended_at=trace.ended_at,
                    duration_ms=duration,
                    span_count=count,
                    incident_count=inc_count,
                    created_at=trace.created_at,
                )
            )
        return summaries

    @staticmethod
    def get_trace_detail(db: Session, trace_id: str) -> Optional[TraceDetailResponse]:
        trace = db.query(Trace).filter(Trace.id == trace_id).first()
        if not trace:
            return None

        project = db.query(Project).filter(Project.id == trace.project_id).first()
        agent = db.query(Agent).filter(Agent.id == trace.agent_id).first()
        spans = (
            db.query(Span)
            .filter(Span.trace_id == trace_id)
            .order_by(Span.timestamp.asc())
            .all()
        )

        duration = None
        if trace.ended_at and trace.started_at:
            duration = max(0.0, (trace.ended_at - trace.started_at).total_seconds() * 1000)

        return TraceDetailResponse(
            id=trace.id,
            project_id=trace.project_id,
            project_name=project.name if project else "Unknown Project",
            agent_id=trace.agent_id,
            agent_name=agent.name if agent else "Unknown Agent",
            agent_framework=agent.framework if agent else None,
            objective=trace.objective,
            status=trace.status,
            started_at=trace.started_at,
            ended_at=trace.ended_at,
            duration_ms=duration,
            created_at=trace.created_at,
            spans=spans,
        )

    @staticmethod
    def get_trace_spans(db: Session, trace_id: str) -> List[Span]:
        return (
            db.query(Span)
            .filter(Span.trace_id == trace_id)
            .order_by(Span.timestamp.asc())
            .all()
        )
