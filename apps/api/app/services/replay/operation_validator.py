from typing import Dict, Any, List, Optional
from .operation_registry import TypedOperation, SUPPORTED_OPERATIONS
from .security_policy import SecurityPolicy, SecurityPolicyError


class OperationValidationError(ValueError):
    """Raised when an operation fails semantic or security validation."""
    pass


class OperationValidator:
    @staticmethod
    def validate_operation(
        operation_name: str,
        arguments: Dict[str, Any],
        protected_paths: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Validates typed operation and arguments.
        Returns a dictionary with validation diagnostics.
        """
        protected_paths = protected_paths or []

        # 1. Check operation type
        valid_ops = {"delete_file", "write_file", "move_file", "run_validation"}
        if operation_name not in valid_ops:
            raise OperationValidationError(
                f"Unsupported operation '{operation_name}'. Only {sorted(list(valid_ops))} are permitted."
            )

        # 2. Validate arguments via Pydantic model
        try:
            typed_op = TypedOperation(operation=operation_name, arguments=arguments)
            parsed_args = typed_op.validate_and_parse_args()
            validated_dict = parsed_args.model_dump()
        except Exception as e:
            raise OperationValidationError(f"Invalid operation arguments: {str(e)}")

        # 3. Check security policy on paths
        affects_protected = False
        matching_protected_rule = None
        target_paths = []

        if operation_name in ("delete_file", "write_file"):
            target_path = validated_dict["path"]
            SecurityPolicy.validate_path_syntax(target_path)
            target_paths.append(target_path)
            is_prot, rule = SecurityPolicy.check_protected_path(target_path, protected_paths)
            if is_prot:
                affects_protected = True
                matching_protected_rule = rule

        elif operation_name == "move_file":
            src = validated_dict["source"]
            dst = validated_dict["destination"]
            SecurityPolicy.validate_path_syntax(src)
            SecurityPolicy.validate_path_syntax(dst)
            target_paths.extend([src, dst])

            is_prot_src, rule_src = SecurityPolicy.check_protected_path(src, protected_paths)
            is_prot_dst, rule_dst = SecurityPolicy.check_protected_path(dst, protected_paths)
            if is_prot_src or is_prot_dst:
                affects_protected = True
                matching_protected_rule = rule_src or rule_dst

        return {
            "valid": True,
            "operation": operation_name,
            "validated_arguments": validated_dict,
            "target_paths": target_paths,
            "affects_protected": affects_protected,
            "matching_protected_rule": matching_protected_rule,
        }
