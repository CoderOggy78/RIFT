#!/usr/bin/env python3
"""
RIFT Phase 2 Deterministic Incident Detection Evaluation Harness.
Imports all test fixtures, executes detection, and computes:
- Incident-level Precision, Recall, and F1
- Rule/Finding-level Precision, Recall, and F1
- First Suspicious Event identification accuracy
Generates both a human-readable console report and a machine-readable JSON evaluation report.
"""

import sys
import json
from pathlib import Path
from typing import Dict, Any, List, Set

# Add backend to sys.path so we can import models and engine directly
BACKEND_DIR = Path(__file__).resolve().parent.parent / "apps" / "api"
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.session import Base
from app.models.models import Trace
from app.schemas.schemas import TraceImportPayload
from app.services.trace_service import TraceService
from app.services.detection.engine import DetectionEngine
from app.services.detection.registry import registry

FIXTURES_DIR = Path(__file__).resolve().parent.parent / "fixtures" / "incidents"
GROUND_TRUTH_FILE = FIXTURES_DIR / "ground_truth.json"
REPORT_OUTPUT_FILE = Path(__file__).resolve().parent.parent / "eval_report.json"


def evaluate():
    print("=" * 70)
    print(" RIFT DETERMINISTIC DETECTION EVALUATION HARNESS")
    print("=" * 70)

    if not GROUND_TRUTH_FILE.exists():
        print(f"[!] Ground truth file not found: {GROUND_TRUTH_FILE}")
        sys.exit(1)

    with open(GROUND_TRUTH_FILE, "r", encoding="utf-8") as f:
        ground_truth: Dict[str, Any] = json.load(f)

    # Use an isolated in-memory or ephemeral test database
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = Session()

    # Track metrics
    incident_metrics = {"tp": 0, "fp": 0, "fn": 0, "tn": 0}
    rule_metrics = {"tp": 0, "fp": 0, "fn": 0}
    first_event_matches = 0
    total_incidents_expected = 0

    per_rule_stats: Dict[str, Dict[str, int]] = {}
    for r in registry.list_rules():
        per_rule_stats[r.rule_id] = {"tp": 0, "fp": 0, "fn": 0}

    results_detail = []

    print(f"\n[+] Registered Rules ({len(registry.list_rules())}):")
    for r in registry.list_rules():
        print(f"    - [{r.rule_id}] {r.name} (Default: {r.default_severity})")

    print(f"\n[+] Ingesting and evaluating {len(ground_truth)} fixtures...\n")

    for trace_id, spec in ground_truth.items():
        fixture_filename = spec["fixture_file"]
        fixture_path = FIXTURES_DIR / fixture_filename

        if not fixture_path.exists():
            print(f"[!] Fixture file missing: {fixture_path}")
            continue

        with open(fixture_path, "r", encoding="utf-8") as f:
            fixture_json = json.load(f)

        payload = TraceImportPayload.model_validate(fixture_json)
        # Import trace
        TraceService.import_trace(db=db, payload=payload, overwrite=True)

        # Run detection
        detected_incidents = DetectionEngine.run_detection(db=db, trace_id=trace_id)

        # Extract detected rules and events
        detected_rule_ids: Set[str] = set()
        first_event_detected = None

        if detected_incidents:
            primary_inc = detected_incidents[0]
            first_event_detected = primary_inc.first_suspicious_event_id
            for inc in detected_incidents:
                for det in inc.detections:
                    detected_rule_ids.add(det.rule_id)

        expected_rule_ids: Set[str] = set(spec.get("expected_rules", []))
        is_incident_expected = spec.get("is_incident_expected", True)
        is_incident_detected = len(detected_incidents) > 0

        # Incident-level evaluation
        if is_incident_expected and is_incident_detected:
            incident_metrics["tp"] += 1
        elif not is_incident_expected and not is_incident_detected:
            incident_metrics["tn"] += 1
        elif not is_incident_expected and is_incident_detected:
            incident_metrics["fp"] += 1
        elif is_incident_expected and not is_incident_detected:
            incident_metrics["fn"] += 1

        # First suspicious event accuracy
        expected_first_event = spec.get("expected_first_suspicious_event_id")
        first_event_correct = False
        if is_incident_expected:
            total_incidents_expected += 1
            if expected_first_event and first_event_detected == expected_first_event:
                first_event_matches += 1
                first_event_correct = True

        # Rule-level evaluation
        rule_tp = len(detected_rule_ids.intersection(expected_rule_ids))
        rule_fp = len(detected_rule_ids - expected_rule_ids)
        rule_fn = len(expected_rule_ids - detected_rule_ids)

        rule_metrics["tp"] += rule_tp
        rule_metrics["fp"] += rule_fp
        rule_metrics["fn"] += rule_fn

        # Per rule breakdown
        for r_id in per_rule_stats:
            in_expected = r_id in expected_rule_ids
            in_detected = r_id in detected_rule_ids
            if in_expected and in_detected:
                per_rule_stats[r_id]["tp"] += 1
            elif in_detected and not in_expected:
                per_rule_stats[r_id]["fp"] += 1
            elif in_expected and not in_detected:
                per_rule_stats[r_id]["fn"] += 1

        status_flag = "PASS" if (rule_fn == 0 and rule_fp == 0 and (not is_incident_expected or first_event_correct)) else "CHECK"

        print(f"  [{status_flag}] {fixture_filename:<32} Expected: {len(expected_rule_ids)} rules | Detected: {len(detected_rule_ids)} rules")
        if expected_first_event:
            print(f"         First Suspicious Event: expected '{expected_first_event}' | got '{first_event_detected}'")

        results_detail.append({
            "trace_id": trace_id,
            "fixture": fixture_filename,
            "expected_rules": list(expected_rule_ids),
            "detected_rules": list(detected_rule_ids),
            "expected_first_event": expected_first_event,
            "detected_first_event": first_event_detected,
            "first_event_match": first_event_correct,
            "incidents_count": len(detected_incidents),
        })

    # Calculate metrics
    def calc_metrics(tp: int, fp: int, fn: int):
        precision = tp / (tp + fp) if (tp + fp) > 0 else 1.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 1.0
        f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
        return precision, recall, f1

    inc_p, inc_r, inc_f1 = calc_metrics(incident_metrics["tp"], incident_metrics["fp"], incident_metrics["fn"])
    rule_p, rule_r, rule_f1 = calc_metrics(rule_metrics["tp"], rule_metrics["fp"], rule_metrics["fn"])
    first_event_acc = first_event_matches / total_incidents_expected if total_incidents_expected > 0 else 1.0

    print("\n" + "=" * 70)
    print(" EVALUATION METRICS SUMMARY")
    print("=" * 70)
    print(f" Fixtures Evaluated:               {len(ground_truth)}")
    print(f" Incident Classification:")
    print(f"   - True Positives:               {incident_metrics['tp']}")
    print(f"   - True Negatives:               {incident_metrics['tn']}")
    print(f"   - False Positives:              {incident_metrics['fp']}")
    print(f"   - False Negatives:              {incident_metrics['fn']}")
    print(f"   - Incident Precision:           {inc_p * 100:.1f}%")
    print(f"   - Incident Recall:              {inc_r * 100:.1f}%")
    print(f"   - Incident F1 Score:            {inc_f1 * 100:.1f}%")
    print(f" Rule / Finding Level:")
    print(f"   - Rule True Positives:          {rule_metrics['tp']}")
    print(f"   - Rule False Positives:         {rule_metrics['fp']}")
    print(f"   - Rule False Negatives:         {rule_metrics['fn']}")
    print(f"   - Rule Precision:               {rule_p * 100:.1f}%")
    print(f"   - Rule Recall:                  {rule_r * 100:.1f}%")
    print(f"   - Rule F1 Score:                {rule_f1 * 100:.1f}%")
    print(f" First Suspicious Event Accuracy:  {first_event_acc * 100:.1f}% ({first_event_matches}/{total_incidents_expected})")
    print("=" * 70)

    # Save JSON report
    report = {
        "summary": {
            "fixtures_count": len(ground_truth),
            "incident_precision": inc_p,
            "incident_recall": inc_r,
            "incident_f1": inc_f1,
            "rule_precision": rule_p,
            "rule_recall": rule_r,
            "rule_f1": rule_f1,
            "first_suspicious_event_accuracy": first_event_acc,
            "incident_metrics": incident_metrics,
            "rule_metrics": rule_metrics,
        },
        "per_rule_breakdown": per_rule_stats,
        "details": results_detail,
    }

    with open(REPORT_OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"[+] Machine-readable evaluation report saved to: {REPORT_OUTPUT_FILE}")


if __name__ == "__main__":
    evaluate()
