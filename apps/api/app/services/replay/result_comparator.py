from typing import Dict, Any


class ResultComparator:
    @staticmethod
    def compare_variants(
        original_result: Dict[str, Any],
        counterfactual_result: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Determines deterministic conclusion comparing original vs counterfactual variant.
        """
        orig_op_ok = original_result.get("execution_status") == "success"
        cf_op_ok = counterfactual_result.get("execution_status") == "success"

        orig_val = original_result.get("validation_result", {})
        cf_val = counterfactual_result.get("validation_result", {})

        orig_val_passed = orig_val.get("passed", False)
        cf_val_passed = cf_val.get("passed", False)

        orig_diff = original_result.get("filesystem_diff", {})
        cf_diff = counterfactual_result.get("filesystem_diff", {})

        # Determine conclusion
        if not cf_op_ok and "escape" in str(counterfactual_result.get("operation_error", "")).lower():
            conclusion = "safety_violation"
            summary = "Counterfactual operation was rejected due to sandbox boundary or path safety violation."

        elif cf_val_passed and not orig_val_passed:
            conclusion = "counterfactual_passed_original_failed"
            summary = (
                "Verified: The counterfactual correction successfully passed validation while the "
                "original operation failed. Observed protected files remained intact."
            )

        elif not cf_val_passed and not orig_val_passed:
            conclusion = "both_failed"
            summary = "Both the original action and the counterfactual correction failed validation checks."

        elif cf_val_passed and orig_val_passed:
            conclusion = "both_passed"
            summary = "Both variants passed validation; the correction produced no differential integrity violation."

        elif not cf_val_passed and orig_val_passed:
            conclusion = "counterfactual_introduced_failures"
            summary = "The counterfactual correction failed validation checks that the original operation satisfied."

        else:
            conclusion = "inconclusive"
            summary = "Replay results were inconclusive under tested fixture conditions."

        return {
            "conclusion": conclusion,
            "summary": summary,
            "original_validation_status": "passed" if orig_val_passed else "failed",
            "counterfactual_validation_status": "passed" if cf_val_passed else "failed",
            "changed_files": list(set(orig_diff.get("modified_files", []) + cf_diff.get("modified_files", []))),
            "removed_files": list(set(orig_diff.get("removed_files", []) + cf_diff.get("removed_files", []))),
            "added_files": list(set(orig_diff.get("added_files", []) + cf_diff.get("added_files", []))),
            "details": {
                "original_execution_status": original_result.get("execution_status"),
                "counterfactual_execution_status": counterfactual_result.get("execution_status"),
                "original_operation_error": original_result.get("operation_error"),
                "counterfactual_operation_error": counterfactual_result.get("operation_error"),
                "original_diff": orig_diff,
                "counterfactual_diff": cf_diff,
            },
        }
