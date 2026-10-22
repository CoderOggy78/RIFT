import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import (
    Column,
    String,
    Text,
    DateTime,
    Float,
    ForeignKey,
    JSON,
    Index,
    Boolean,
    Integer,
)
from sqlalchemy.orm import relationship, relationship as orm_relationship
from app.db.session import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Project(Base):
    __tablename__ = "projects"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    agents = relationship("Agent", back_populates="project", cascade="all, delete-orphan")
    traces = relationship("Trace", back_populates="project", cascade="all, delete-orphan")


class Agent(Base):
    __tablename__ = "agents"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(64), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    framework = Column(String(128), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    project = relationship("Project", back_populates="agents")
    traces = relationship("Trace", back_populates="agent", cascade="all, delete-orphan")


class Trace(Base):
    __tablename__ = "traces"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(64), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    agent_id = Column(String(64), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True)
    objective = Column(Text, nullable=False)
    status = Column(String(64), nullable=False, default="running", index=True)
    started_at = Column(DateTime(timezone=True), nullable=False)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    project = relationship("Project", back_populates="traces")
    agent = relationship("Agent", back_populates="traces")
    spans = relationship(
        "Span",
        back_populates="trace",
        cascade="all, delete-orphan",
        order_by="Span.timestamp.asc()",
    )
    incidents = relationship(
        "Incident",
        back_populates="trace",
        cascade="all, delete-orphan",
        order_by="Incident.created_at.desc()",
    )
    detections = relationship(
        "Detection",
        back_populates="trace",
        cascade="all, delete-orphan",
        order_by="Detection.created_at.asc()",
    )
    investigations = relationship(
        "Investigation",
        back_populates="trace",
        cascade="all, delete-orphan",
        order_by="Investigation.created_at.desc()",
    )

    __table_args__ = (
        Index("idx_trace_status_started", "status", "started_at"),
    )


class Span(Base):
    __tablename__ = "spans"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    trace_id = Column(String(64), ForeignKey("traces.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_span_id = Column(String(64), ForeignKey("spans.id", ondelete="SET NULL"), nullable=True, index=True)
    event_type = Column(String(64), nullable=False, index=True)  # user_prompt, agent_plan, model_call, tool_call, tool_result, validation, error
    name = Column(String(255), nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    duration_ms = Column(Float, nullable=True)
    status = Column(String(64), nullable=False, default="success", index=True)  # success, error, running
    input_data = Column(JSON, nullable=False, default=dict)
    output_data = Column(JSON, nullable=False, default=dict)
    error_data = Column(JSON, nullable=False, default=dict)
    metadata_payload = Column(JSON, nullable=False, default=dict)

    # Relationships
    trace = relationship("Trace", back_populates="spans")
    parent = relationship("Span", remote_side=[id], backref="children")

    __table_args__ = (
        Index("idx_span_trace_timestamp", "trace_id", "timestamp"),
        Index("idx_span_trace_event", "trace_id", "event_type"),
    )


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(String(64), primary_key=True, default=lambda: f"inc-{uuid.uuid4().hex[:12]}")
    trace_id = Column(String(64), ForeignKey("traces.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    severity = Column(String(32), nullable=False, default="Medium", index=True)  # Critical, High, Medium, Low, Informational
    status = Column(String(32), nullable=False, default="Open", index=True)  # Open, Investigating, Resolved, Closed
    first_suspicious_event_id = Column(String(64), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    # Relationships
    trace = relationship("Trace", back_populates="incidents")
    detections = relationship(
        "Detection",
        back_populates="incident",
        cascade="all, delete-orphan",
        order_by="Detection.created_at.asc()",
    )
    investigations = relationship(
        "Investigation",
        back_populates="incident",
        cascade="all, delete-orphan",
        order_by="Investigation.created_at.desc()",
    )
    replays = relationship(
        "Replay",
        back_populates="incident",
        cascade="all, delete-orphan",
        order_by="Replay.created_at.desc()",
    )

    __table_args__ = (
        Index("idx_incident_trace_severity", "trace_id", "severity"),
        Index("idx_incident_status_severity", "status", "severity"),
    )


class Detection(Base):
    __tablename__ = "detections"

    id = Column(String(64), primary_key=True, default=lambda: f"det-{uuid.uuid4().hex[:12]}")
    incident_id = Column(String(64), ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False, index=True)
    trace_id = Column(String(64), ForeignKey("traces.id", ondelete="CASCADE"), nullable=False, index=True)
    rule_id = Column(String(64), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    severity = Column(String(32), nullable=False, default="Medium", index=True)
    verification_status = Column(String(32), nullable=False, default="CONFIRMED")  # CONFIRMED, SUSPECTED, INSUFFICIENT_EVIDENCE
    details = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    incident = relationship("Incident", back_populates="detections")
    trace = relationship("Trace", back_populates="detections")
    evidence = relationship(
        "EvidenceReference",
        back_populates="detection",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("idx_detection_rule_trace", "rule_id", "trace_id"),
    )


class EvidenceReference(Base):
    __tablename__ = "evidence_references"

    id = Column(String(64), primary_key=True, default=lambda: f"ev-{uuid.uuid4().hex[:12]}")
    detection_id = Column(String(64), ForeignKey("detections.id", ondelete="CASCADE"), nullable=False, index=True)
    trace_id = Column(String(64), ForeignKey("traces.id", ondelete="CASCADE"), nullable=False, index=True)
    event_id = Column(String(64), nullable=False, index=True)
    evidence_type = Column(String(64), nullable=False)  # DESTRUCTIVE_CALL, FAILED_RESULT, INVALID_ARGUMENT, etc.
    description = Column(Text, nullable=False)

    # Relationships
    detection = relationship("Detection", back_populates="evidence")

    __table_args__ = (
        Index("idx_evidence_event_trace", "event_id", "trace_id"),
    )


class Investigation(Base):
    __tablename__ = "investigations"

    id = Column(String(64), primary_key=True, default=lambda: f"inv-{uuid.uuid4().hex[:12]}")
    incident_id = Column(String(64), ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False, index=True)
    trace_id = Column(String(64), ForeignKey("traces.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(32), nullable=False, default="queued", index=True)  # queued, running, completed, failed, cancelled
    model_name = Column(String(128), nullable=False)
    prompt_version = Column(String(32), nullable=False, default="v1.0.0")
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    duration_ms = Column(Float, nullable=True)
    failure_code = Column(String(64), nullable=True)  # e.g., MODEL_UNAVAILABLE, MODEL_TIMEOUT, PARSING_ERROR
    failure_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # High-level outputs
    summary = Column(Text, nullable=True)
    observed_failure = Column(Text, nullable=True)
    conclusion_status = Column(String(32), nullable=True)  # conclusive, partially_conclusive, inconclusive
    first_suspicious_event_id = Column(String(64), nullable=True)
    evidence_count = Column(Integer, default=0, nullable=False)
    is_truncated = Column(Boolean, default=False, nullable=False)
    raw_model_output = Column(Text, nullable=True)

    # Relationships
    incident = relationship("Incident", back_populates="investigations")
    trace = relationship("Trace", back_populates="investigations")
    hypotheses = relationship(
        "Hypothesis",
        back_populates="investigation",
        cascade="all, delete-orphan",
        order_by="Hypothesis.rank.asc()",
    )
    all_evidence = relationship(
        "InvestigationEvidence",
        back_populates="investigation",
        cascade="all, delete-orphan",
    )
    remediations = relationship(
        "RemediationSuggestion",
        back_populates="investigation",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("idx_investigation_incident_status", "incident_id", "status"),
        Index("idx_investigation_trace", "trace_id"),
    )


class Hypothesis(Base):
    __tablename__ = "hypotheses"

    id = Column(String(64), primary_key=True, default=lambda: f"hyp-{uuid.uuid4().hex[:12]}")
    investigation_id = Column(String(64), ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    explanation = Column(Text, nullable=False)
    confidence_level = Column(String(32), nullable=False, default="medium")  # high, medium, low
    verification_status = Column(String(32), nullable=False, default="unverified")  # supported, partially_supported, unverified, contradicted
    suggested_check = Column(Text, nullable=True)
    rank = Column(Integer, default=1, nullable=False)
    missing_evidence = Column(JSON, nullable=False, default=list)

    # Relationships
    investigation = relationship("Investigation", back_populates="hypotheses")
    evidence = relationship(
        "InvestigationEvidence",
        back_populates="hypothesis",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("idx_hypothesis_investigation_rank", "investigation_id", "rank"),
    )


class InvestigationEvidence(Base):
    __tablename__ = "investigation_evidence"

    id = Column(String(64), primary_key=True, default=lambda: f"invev-{uuid.uuid4().hex[:12]}")
    investigation_id = Column(String(64), ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False, index=True)
    hypothesis_id = Column(String(64), ForeignKey("hypotheses.id", ondelete="CASCADE"), nullable=True, index=True)
    event_id = Column(String(64), nullable=False, index=True)
    relationship = Column(String(32), nullable=False, default="supporting")  # supporting, contradicting, contextual
    explanation = Column(Text, nullable=True)

    # Relationships
    investigation = orm_relationship("Investigation", back_populates="all_evidence")
    hypothesis = orm_relationship("Hypothesis", back_populates="evidence")

    __table_args__ = (
        Index("idx_invev_hypothesis", "hypothesis_id"),
        Index("idx_invev_event", "event_id"),
    )


class RemediationSuggestion(Base):
    __tablename__ = "remediation_suggestions"

    id = Column(String(64), primary_key=True, default=lambda: f"rem-{uuid.uuid4().hex[:12]}")
    investigation_id = Column(String(64), ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False, index=True)
    description = Column(Text, nullable=False)
    rationale = Column(Text, nullable=True)
    risk_level = Column(String(32), nullable=False, default="low")  # low, medium, high
    verification_method = Column(Text, nullable=True)
    requires_human_approval = Column(Boolean, nullable=False, default=True)

    # Relationships
    investigation = relationship("Investigation", back_populates="remediations")

    __table_args__ = (
        Index("idx_remediation_investigation", "investigation_id"),
    )


class Replay(Base):
    __tablename__ = "replays"

    id = Column(String(64), primary_key=True, default=lambda: f"rpl-{uuid.uuid4().hex[:12]}")
    incident_id = Column(String(64), ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False, index=True)
    investigation_id = Column(String(64), ForeignKey("investigations.id", ondelete="SET NULL"), nullable=True, index=True)
    original_event_id = Column(String(64), nullable=False, index=True)
    status = Column(String(32), nullable=False, default="pending", index=True)  # pending, approved, queued, running, completed, failed, cancelled
    fixture_id = Column(String(64), nullable=False, default="fixture-accidental-deletion")
    approved_by_user = Column(Boolean, nullable=False, default=False)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    failure_code = Column(String(64), nullable=True)
    failure_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    incident = relationship("Incident", back_populates="replays")
    investigation = relationship("Investigation")
    variants = relationship(
        "ReplayVariant",
        back_populates="replay",
        cascade="all, delete-orphan",
        order_by="ReplayVariant.created_at.asc()",
    )
    comparison = relationship(
        "ReplayComparison",
        back_populates="replay",
        uselist=False,
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("idx_replay_incident_status", "incident_id", "status"),
    )


class ReplayVariant(Base):
    __tablename__ = "replay_variants"

    id = Column(String(64), primary_key=True, default=lambda: f"rplvar-{uuid.uuid4().hex[:12]}")
    replay_id = Column(String(64), ForeignKey("replays.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_type = Column(String(32), nullable=False)  # original, counterfactual
    operation_type = Column(String(32), nullable=False)  # write_file, delete_file, move_file, run_validation
    validated_arguments = Column(JSON, nullable=False, default=dict)
    execution_status = Column(String(32), nullable=False, default="pending")  # pending, success, failed, skipped
    validation_status = Column(String(32), nullable=False, default="pending")  # pending, passed, failed, skipped
    duration_ms = Column(Float, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    replay = relationship("Replay", back_populates="variants")
    artifacts = relationship(
        "ReplayArtifact",
        back_populates="variant",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("idx_replay_variant_type", "replay_id", "variant_type"),
    )


class ReplayArtifact(Base):
    __tablename__ = "replay_artifacts"

    id = Column(String(64), primary_key=True, default=lambda: f"rplart-{uuid.uuid4().hex[:12]}")
    replay_variant_id = Column(String(64), ForeignKey("replay_variants.id", ondelete="CASCADE"), nullable=False, index=True)
    artifact_type = Column(String(32), nullable=False)  # file, diff, manifest, log
    relative_path = Column(String(255), nullable=False)
    content_hash = Column(String(64), nullable=False)
    artifact_metadata = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    variant = relationship("ReplayVariant", back_populates="artifacts")

    __table_args__ = (
        Index("idx_rplart_variant_type", "replay_variant_id", "artifact_type"),
    )


class ReplayComparison(Base):
    __tablename__ = "replay_comparisons"

    id = Column(String(64), primary_key=True, default=lambda: f"rplcmp-{uuid.uuid4().hex[:12]}")
    replay_id = Column(String(64), ForeignKey("replays.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    original_validation_status = Column(String(32), nullable=False)  # passed, failed, skipped
    counterfactual_validation_status = Column(String(32), nullable=False)  # passed, failed, skipped
    changed_files = Column(JSON, nullable=False, default=list)
    removed_files = Column(JSON, nullable=False, default=list)
    added_files = Column(JSON, nullable=False, default=list)
    conclusion = Column(String(64), nullable=False)  # counterfactual_passed_original_failed, both_failed, both_passed, counterfactual_introduced_failures, inconclusive, safety_violation
    details = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    replay = relationship("Replay", back_populates="comparison")

