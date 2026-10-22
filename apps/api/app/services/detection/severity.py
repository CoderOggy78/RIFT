from enum import Enum
from typing import List, Iterable


class Severity(str, Enum):
    CRITICAL = "Critical"
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"
    INFORMATIONAL = "Informational"


SEVERITY_WEIGHTS = {
    Severity.CRITICAL.value: 5,
    Severity.HIGH.value: 4,
    Severity.MEDIUM.value: 3,
    Severity.LOW.value: 2,
    Severity.INFORMATIONAL.value: 1,
}


def normalize_severity(val: str) -> str:
    """Normalize arbitrary case strings to canonical Severity value."""
    s = str(val or "").strip().capitalize()
    if s in SEVERITY_WEIGHTS:
        return s
    upper = str(val or "").strip().upper()
    if upper == "CRITICAL":
        return Severity.CRITICAL.value
    if upper == "HIGH":
        return Severity.HIGH.value
    if upper == "MEDIUM":
        return Severity.MEDIUM.value
    if upper == "LOW":
        return Severity.LOW.value
    if upper == "INFORMATIONAL" or upper == "INFO":
        return Severity.INFORMATIONAL.value
    return Severity.MEDIUM.value


def compare_severity(s1: str, s2: str) -> int:
    """Returns > 0 if s1 > s2, 0 if equal, < 0 if s1 < s2."""
    w1 = SEVERITY_WEIGHTS.get(normalize_severity(s1), 0)
    w2 = SEVERITY_WEIGHTS.get(normalize_severity(s2), 0)
    return w1 - w2


def max_severity(severities: Iterable[str]) -> str:
    """Returns the highest severity among an iterable of severities."""
    highest = Severity.INFORMATIONAL.value
    highest_weight = 1
    for s in severities:
        norm = normalize_severity(s)
        weight = SEVERITY_WEIGHTS.get(norm, 1)
        if weight > highest_weight:
            highest_weight = weight
            highest = norm
    return highest
