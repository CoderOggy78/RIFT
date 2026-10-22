from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Any, Optional
from app.services.detection.severity import Severity, normalize_severity


class VerificationStatus(str, Enum):
    CONFIRMED = "CONFIRMED"
    SUSPECTED = "SUSPECTED"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"


@dataclass
class EvidenceItem:
    event_id: str
    evidence_type: str
    description: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_id": self.event_id,
            "evidence_type": self.evidence_type,
            "description": self.description,
        }


@dataclass
class RawFinding:
    rule_id: str
    rule_name: str
    title: str
    description: str
    severity: str
    verification_status: str = VerificationStatus.CONFIRMED.value
    first_suspicious_event_id: Optional[str] = None
    evidence_items: List[EvidenceItem] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        self.severity = normalize_severity(self.severity)
        if not self.first_suspicious_event_id and self.evidence_items:
            self.first_suspicious_event_id = self.evidence_items[0].event_id
