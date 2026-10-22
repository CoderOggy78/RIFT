import asyncio
import logging
from app.db.session import SessionLocal
from .orchestrator import ReplayOrchestrator

logger = logging.getLogger(__name__)


class ReplayJobRunner:
    @staticmethod
    async def run_replay_job(replay_id: str, allow_isolated_fallback: bool = True) -> None:
        """
        Asynchronously executes a queued replay session in a background task.
        """
        db = SessionLocal()
        try:
            # Run in worker thread
            await asyncio.to_thread(
                ReplayOrchestrator.execute_replay_session,
                db=db,
                replay_id=replay_id,
                allow_isolated_fallback=allow_isolated_fallback,
            )
        except Exception as e:
            logger.error(f"Replay job {replay_id} failed: {e}", exc_info=True)
        finally:
            db.close()
