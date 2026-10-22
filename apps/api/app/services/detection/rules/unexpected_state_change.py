from typing import List, Dict, Any, Set
from app.services.detection.registry import BaseRule
from app.services.detection.context import TraceContext
from app.services.detection.evidence import RawFinding, EvidenceItem, VerificationStatus
from app.services.detection.severity import Severity


class UnexpectedStateChangeRule(BaseRule):
    rule_id = "RULE-008"
    name = "Unexpected Filesystem State Change"
    description = "Detects unexpected file deletions, file creations, or hash drifts through filesystem snapshot comparisons."
    default_severity = Severity.HIGH.value

    def evaluate(self, context: TraceContext) -> List[RawFinding]:
        findings: List[RawFinding] = []

        # Look for explicit snapshot manifests in trace or span metadata
        # (e.g. initial_filesystem_manifest and final_filesystem_manifest)
        trace_meta = context.trace.metadata_payload if hasattr(context.trace, "metadata_payload") and context.trace.metadata_payload else {}
        initial_manifest: Dict[str, Any] = trace_meta.get("initial_manifest") or {}
        final_manifest: Dict[str, Any] = trace_meta.get("final_manifest") or {}

        # Also inspect spans for before/after state manifests
        manifest_span = None
        for span in context.spans:
            if "before_manifest" in span.metadata_payload and "after_manifest" in span.metadata_payload:
                initial_manifest = span.metadata_payload["before_manifest"]
                final_manifest = span.metadata_payload["after_manifest"]
                manifest_span = span
                break

        # If snapshots are unavailable, return no findings (do not fabricate!)
        if not initial_manifest or not final_manifest:
            return findings

        # Compare manifests
        initial_files: Set[str] = set(initial_manifest.keys())
        final_files: Set[str] = set(final_manifest.keys())

        removed_files = initial_files - final_files
        added_files = final_files - initial_files
        modified_files = set()

        for f in initial_files.intersection(final_files):
            init_hash = initial_manifest[f]
            fin_hash = final_manifest[f]
            if isinstance(init_hash, dict):
                init_hash = init_hash.get("hash") or init_hash.get("content")
            if isinstance(fin_hash, dict):
                fin_hash = fin_hash.get("hash") or fin_hash.get("content")
            if init_hash and fin_hash and init_hash != fin_hash:
                modified_files.add(f)

        # Check for unexpected changes outside allowed scope or targeting protected paths
        unexpected_removals = [
            f for f in removed_files if not context.policy.is_path_allowed_for_deletion(f)
        ]
        unexpected_modifications = [
            f for f in modified_files if context.policy.is_path_protected(f)
        ]

        if unexpected_removals or unexpected_modifications:
            ev_id = manifest_span.id if manifest_span else context.spans[0].id
            evidence = []

            for r in unexpected_removals:
                evidence.append(
                    EvidenceItem(
                        event_id=ev_id,
                        evidence_type="UNEXPECTED_DELETION",
                        description=f"Snapshot confirms removal of unauthorized path: '{r}'.",
                    )
                )

            for m in unexpected_modifications:
                evidence.append(
                    EvidenceItem(
                        event_id=ev_id,
                        evidence_type="UNEXPECTED_MODIFICATION",
                        description=f"Snapshot confirms hash drift on protected file: '{m}'.",
                    )
                )

            findings.append(
                RawFinding(
                    rule_id=self.rule_id,
                    rule_name=self.name,
                    title="Unexpected State Drift in Filesystem Manifest",
                    description=(
                        f"Manifest comparison revealed unauthorized state changes: "
                        f"{len(unexpected_removals)} unauthorized removals, "
                        f"{len(unexpected_modifications)} protected file modifications."
                    ),
                    severity=Severity.HIGH.value,
                    verification_status=VerificationStatus.CONFIRMED.value,
                    first_suspicious_event_id=ev_id,
                    evidence_items=evidence,
                    details={
                        "unexpected_removals": unexpected_removals,
                        "unexpected_modifications": list(unexpected_modifications),
                        "total_removed": len(removed_files),
                        "total_added": len(added_files),
                    },
                )
            )

        return findings
