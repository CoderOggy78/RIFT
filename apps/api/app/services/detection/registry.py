from abc import ABC, abstractmethod
from typing import List, Dict, Optional, Type
from app.services.detection.context import TraceContext
from app.services.detection.evidence import RawFinding
from app.services.detection.severity import Severity


class BaseRule(ABC):
    rule_id: str
    name: str
    description: str
    default_severity: str = Severity.MEDIUM.value

    @abstractmethod
    def evaluate(self, context: TraceContext) -> List[RawFinding]:
        """
        Evaluate trace context against deterministic rule invariants.
        Returns a list of RawFinding objects. Must never raise unhandled exceptions.
        """
        pass

    def to_dict(self) -> Dict[str, str]:
        return {
            "rule_id": self.rule_id,
            "name": self.name,
            "description": self.description,
            "default_severity": self.default_severity,
        }


class RuleRegistry:
    def __init__(self):
        self._rules: Dict[str, BaseRule] = {}

    def register(self, rule: BaseRule):
        self._rules[rule.rule_id] = rule

    def get_rule(self, rule_id: str) -> Optional[BaseRule]:
        return self._rules.get(rule_id)

    def list_rules(self) -> List[BaseRule]:
        return sorted(list(self._rules.values()), key=lambda r: r.rule_id)


registry = RuleRegistry()
