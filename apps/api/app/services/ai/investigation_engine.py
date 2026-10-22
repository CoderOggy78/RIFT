import time
import asyncio
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.models import (
    Investigation,
    Incident,
    Trace,
    Span,
    Detection,
    Hypothesis,
    InvestigationEvidence,
    RemediationSuggestion,
    utc_now,
)
from app.services.ai.context_builder import ContextBuilder
from app.services.ai.prompt_manager import PROMPT_VERSION
from app.services.ai.gemma_client import (
    GemmaClient,
    OllamaUnavailableError,
    ModelMissingError,
    InferenceTimeoutError,
)
from app.services.ai.output_parser import InvalidOutputError, GemmaInvestigationOutput
from app.services.ai.hypothesis_validator import HypothesisValidator
from app.services.ai.evidence_validator import EvidenceValidator

# Limit concurrent local inference to 1 on 16 GB Apple Silicon Mac
_INFERENCE_SEMAPHORE = asyncio.Semaphore(settings.GEMMA_MAX_CONCURRENT_REQUESTS)


class InvestigationEngine:
    def __init__(self, gemma_client: Optional[GemmaClient] = None):
        self.client = gemma_client or GemmaClient()
        self.context_builder = ContextBuilder()

    async def execute_investigation(self, db: Session, investigation_id: str) -> Investigation:
        """
        Executes the end-to-end investigation pipeline for a queued investigation.
        Updates state transitions: queued -> running -> completed (or failed).
        """
        investigation: Optional[Investigation] = (
            db.query(Investigation).filter(Investigation.id == investigation_id).first()
        )
        if not investigation:
            raise ValueError(f"Investigation {investigation_id} not found.")

        incident: Optional[Incident] = (
            db.query(Incident).filter(Incident.id == investigation.incident_id).first()
        )
        if not incident:
            investigation.status = "failed"
            investigation.failure_code = "INCIDENT_NOT_FOUND"
            investigation.failure_message = f"Associated incident {investigation.incident_id} not found."
            investigation.completed_at = utc_now()
            db.commit()
            return investigation

        trace: Optional[Trace] = (
            db.query(Trace).filter(Trace.id == investigation.trace_id).first()
        )
        if not trace:
            investigation.status = "failed"
            investigation.failure_code = "TRACE_NOT_FOUND"
            investigation.failure_message = f"Associated trace {investigation.trace_id} not found."
            investigation.completed_at = utc_now()
            db.commit()
            return investigation

        # Transition to RUNNING
        investigation.status = "running"
        investigation.started_at = utc_now()
        db.commit()

        start_time = time.time()

        try:
            # 1. Fetch trace telemetry and deterministic detections
            spans = db.query(Span).filter(Span.trace_id == trace.id).order_by(Span.timestamp.asc()).all()
            detections = (
                db.query(Detection)
                .filter(Detection.incident_id == incident.id)
                .order_by(Detection.created_at.asc())
                .all()
            )

            # 2. Build Bounded Evidence Package
            evidence_package = self.context_builder.build_evidence_package(
                incident=incident,
                trace=trace,
                detections=detections,
                spans=spans,
                first_suspicious_event_id=incident.first_suspicious_event_id,
            )
            evidence_json_str = self.context_builder.serialize_to_json(evidence_package)
            is_truncated = evidence_package.get("metadata", {}).get("is_truncated", False)

            # 3. Invoke Local Gemma via Ollama (bounded concurrency)
            async with _INFERENCE_SEMAPHORE:
                parsed_output, raw_text, duration_ms = await self.client.generate_investigation(
                    evidence_json_str
                )

            # 4. Post-processing & Verification with HypothesisValidator
            hyp_validator = HypothesisValidator(spans, detections)
            processed_hypotheses = hyp_validator.process_hypotheses(parsed_output.hypotheses)

            # Validate first suspicious event ID against real trace spans
            ev_validator = EvidenceValidator(spans, detections)
            validated_first_suspicious, _ = ev_validator.validate_first_suspicious_event(
                parsed_output.first_suspicious_event_id
            )

            # 5. Persist Validated Findings in SQLite
            investigation.summary = parsed_output.summary
            investigation.observed_failure = parsed_output.observed_failure
            investigation.first_suspicious_event_id = validated_first_suspicious or incident.first_suspicious_event_id
            investigation.conclusion_status = parsed_output.investigation_status
            investigation.raw_model_output = raw_text
            investigation.duration_ms = duration_ms
            investigation.is_truncated = is_truncated
            investigation.prompt_version = PROMPT_VERSION

            total_evidence_count = 0

            # Persist Hypotheses & Evidence Relationships
            for pHyp in processed_hypotheses:
                db_hyp = Hypothesis(
                    investigation_id=investigation.id,
                    title=pHyp.title,
                    explanation=pHyp.explanation,
                    confidence_level=pHyp.confidence_level,
                    verification_status=pHyp.verification_status,
                    suggested_check=pHyp.suggested_check,
                    rank=pHyp.rank,
                    missing_evidence=pHyp.missing_evidence,
                )
                db.add(db_hyp)
                db.flush()

                # Add Supporting Evidence
                for eid in pHyp.supporting_events:
                    db_ev = InvestigationEvidence(
                        investigation_id=investigation.id,
                        hypothesis_id=db_hyp.id,
                        event_id=eid,
                        relationship="supporting",
                        explanation=f"Corroborating telemetry event for '{pHyp.title}'",
                    )
                    db.add(db_ev)
                    total_evidence_count += 1

                # Add Contradicting Evidence
                for eid in pHyp.contradicting_events:
                    db_ev = InvestigationEvidence(
                        investigation_id=investigation.id,
                        hypothesis_id=db_hyp.id,
                        event_id=eid,
                        relationship="contradicting",
                        explanation=f"Contradicting telemetry event for '{pHyp.title}'",
                    )
                    db.add(db_ev)
                    total_evidence_count += 1

            # Persist Remediation Suggestions
            for rem in parsed_output.remediation:
                db_rem = RemediationSuggestion(
                    investigation_id=investigation.id,
                    description=rem.action,
                    rationale=rem.rationale,
                    risk_level=rem.risk,
                    verification_method=rem.verification_method or "",
                    requires_human_approval=rem.requires_human_approval,
                )
                db.add(db_rem)

            investigation.evidence_count = total_evidence_count
            investigation.status = "completed"
            investigation.completed_at = utc_now()
            db.commit()
            db.refresh(investigation)
            return investigation

        except OllamaUnavailableError as err:
            duration_ms = round((time.time() - start_time) * 1000, 2)
            investigation.status = "failed"
            investigation.failure_code = "OLLAMA_UNAVAILABLE"
            investigation.failure_message = str(err)
            investigation.duration_ms = duration_ms
            investigation.completed_at = utc_now()
            db.commit()
            return investigation

        except ModelMissingError as err:
            duration_ms = round((time.time() - start_time) * 1000, 2)
            investigation.status = "failed"
            investigation.failure_code = "MODEL_MISSING"
            investigation.failure_message = str(err)
            investigation.duration_ms = duration_ms
            investigation.completed_at = utc_now()
            db.commit()
            return investigation

        except InferenceTimeoutError as err:
            duration_ms = round((time.time() - start_time) * 1000, 2)
            investigation.status = "failed"
            investigation.failure_code = "INFERENCE_TIMEOUT"
            investigation.failure_message = str(err)
            investigation.duration_ms = duration_ms
            investigation.completed_at = utc_now()
            db.commit()
            return investigation

        except InvalidOutputError as err:
            duration_ms = round((time.time() - start_time) * 1000, 2)
            investigation.status = "failed"
            investigation.failure_code = "PARSING_ERROR"
            investigation.failure_message = f"Gemma output parsing error: {err.message}"
            investigation.raw_model_output = err.raw_output
            investigation.duration_ms = duration_ms
            investigation.completed_at = utc_now()
            db.commit()
            return investigation

        except Exception as err:
            duration_ms = round((time.time() - start_time) * 1000, 2)
            investigation.status = "failed"
            investigation.failure_code = "UNEXPECTED_ERROR"
            investigation.failure_message = f"Investigation failure: {str(err)}"
            investigation.duration_ms = duration_ms
            investigation.completed_at = utc_now()
            db.commit()
            return investigation
