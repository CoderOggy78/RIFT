from pathlib import Path
from typing import Dict, Any


def execute_run_validation(workspace: Path, arguments: Dict[str, Any], validators_registry: Dict[str, Any]) -> Dict[str, Any]:
    validator_id = arguments.get("validator_id")
    if not validator_id:
        raise ValueError("Missing required 'validator_id' in run_validation operation")

    validator_fn = validators_registry.get(validator_id)
    if not validator_fn:
        raise ValueError(f"Unknown or unregistered validator: '{validator_id}'")

    result = validator_fn(workspace)
    return {
        "operation": "run_validation",
        "validator_id": validator_id,
        "result": result,
        "status": "success" if result.get("passed", False) else "failed",
    }
