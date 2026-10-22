import asyncio
import logging
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.models import Investigation, Incident, utc_now
from app.core.config import settings
from app.services.ai.investigation_engine import InvestigationEngine

logger = logging.getLogger("rift.investigation_jobs")


class InvestigationJobManager:
    _active_tasks: Dict[str, asyncio.Task] = {}

    @classmethod
    async def create_and_enqueue_investigation(
        cls, db: Session, incident_id: str
    ) -> Investigation:
        """
        Validates the incident, checks for existing active jobs,
        creates a queued Investigation record, and spawns background worker.
        """
        incident = db.query(Incident).filter(Incident.id == incident_id).first()
        if not incident:
            raise ValueError(f"Incident '{incident_id}' does not exist.")

        # Check for already running or queued investigation for this incident
        existing_active = (
            db.query(Investigation)
            .filter(
                Investigation.incident_id == incident_id,
                Investigation.status.in_(["queued", "running"]),
            )
            .first()
        )
        if existing_active:
            return existing_active

        # Create new queued investigation
        investigation = Investigation(
            incident_id=incident.id,
            trace_id=incident.trace_id,
            status="queued",
            model_name=settings.GEMMA_MODEL,
            prompt_version="v1.0.0",
            created_at=utc_now(),
        )
        db.add(investigation)
        db.commit()
        db.refresh(investigation)

        # Launch background task
        task = asyncio.create_task(
            cls._run_investigation_worker(investigation.id)
        )
        cls._active_tasks[investigation.id] = task

        return investigation

    @classmethod
    async def _run_investigation_worker(cls, investigation_id: str) -> None:
        """Isolated background worker running investigation engine with its own DB session."""
        worker_db: Session = SessionLocal()
        try:
            engine = InvestigationEngine()
            await engine.execute_investigation(worker_db, investigation_id)
        except Exception as e:
            logger.exception(f"Unhandled exception in investigation worker for {investigation_id}: {e}")
            try:
                inv = worker_db.query(Investigation).filter(Investigation.id == investigation_id).first()
                if inv and inv.status in ("queued", "running"):
                    inv.status = "failed"
                    inv.failure_code = "WORKER_CRASH"
                    inv.failure_message = f"Background worker exception: {str(e)}"
                    inv.completed_at = utc_now()
                    worker_db.commit()
            except Exception:
                pass
        finally:
            cls._active_tasks.pop(investigation_id, None)
            worker_db.close()

    @classmethod
    def cancel_investigation(cls, db: Session, investigation_id: str) -> Optional[Investigation]:
        """Cancels an in-flight investigation task if still running or queued."""
        inv = db.query(Investigation).filter(Investigation.id == investigation_id).first()
        if not inv:
            return None

        if inv.status in ("queued", "running"):
            task = cls._active_tasks.get(investigation_id)
            if task and not task.done():
                task.cancel()

            inv.status = "cancelled"
            inv.completed_at = utc_now()
            inv.failure_message = "Investigation cancelled by user."
            db.commit()
            db.refresh(inv)

        return inv
