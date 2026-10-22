from app.services.detection.registry import registry
from app.services.detection.rules.unsafe_deletion import UnsafeDeletionRule
from app.services.detection.rules.protected_modification import ProtectedModificationRule
from app.services.detection.rules.invalid_arguments import InvalidArgumentsRule
from app.services.detection.rules.tool_failure import ToolFailureRule
from app.services.detection.rules.repeated_failure import RepeatedFailureRule
from app.services.detection.rules.false_success import FalseSuccessRule
from app.services.detection.rules.missing_validation import MissingValidationRule
from app.services.detection.rules.unexpected_state_change import UnexpectedStateChangeRule

# Register all standard deterministic rules
rule_instances = [
    UnsafeDeletionRule(),
    ProtectedModificationRule(),
    InvalidArgumentsRule(),
    ToolFailureRule(),
    RepeatedFailureRule(),
    FalseSuccessRule(),
    MissingValidationRule(),
    UnexpectedStateChangeRule(),
]

for rule in rule_instances:
    registry.register(rule)

__all__ = [
    "UnsafeDeletionRule",
    "ProtectedModificationRule",
    "InvalidArgumentsRule",
    "ToolFailureRule",
    "RepeatedFailureRule",
    "FalseSuccessRule",
    "MissingValidationRule",
    "UnexpectedStateChangeRule",
    "rule_instances",
]
