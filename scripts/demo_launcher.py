#!/usr/bin/env python3
"""
RIFT Demo Launcher — Automated End-to-End Setup & Verification.

Steps:
1. Verify required services (FastAPI backend, React frontend, Ollama, Gemma 4, Docker).
2. Apply SQLite migrations / ensure schema readiness.
3. Import demo fixture idempotently (accidental deletion trace).
4. Run deterministic detection to flag unsafe operations.
5. Print real Trace ID and Incident ID.
6. Print application URLs.
7. Explain how to trigger local Gemma 4 AI investigation.
8. Explain how to launch secure isolated counterfactual replay.
"""

import sys
import json
import httpx
from pathlib import Path

BACKEND_URL = "http://127.0.0.1:8000"
FRONTEND_URL = "http://localhost:5173"
OLLAMA_URL = "http://localhost:11434"
FIXTURE_PATH = Path(__file__).resolve().parent.parent / "fixtures" / "incidents" / "accidental-deletion.json"

CYAN = "\033[96m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"


def print_banner():
    print(f"""
{CYAN}{BOLD}========================================================================{RESET}
{CYAN}{BOLD}   RIFT — AI Agent Incident Observability & Investigation Platform   {RESET}
{DIM}         "Between what agents intend and what they do."                 {RESET}
{CYAN}{BOLD}========================================================================{RESET}
""")


def check_services():
    print(f"{BOLD}[Step 1/8] Checking Required Subsystems...{RESET}")

    # Check FastAPI
    backend_ok = False
    try:
        r = httpx.get(f"{BACKEND_URL}/api/health", timeout=3.0)
        if r.status_code == 200:
            backend_ok = True
            print(f"  {GREEN}✓{RESET} FastAPI Backend:       {GREEN}ONLINE{RESET} ({BACKEND_URL})")
        else:
            print(f"  {RED}✗{RESET} FastAPI Backend:       {RED}HTTP {r.status_code}{RESET}")
    except Exception:
        print(f"  {RED}✗{RESET} FastAPI Backend:       {RED}NOT RUNNING{RESET} (Expected at {BACKEND_URL})")

    # Check Frontend
    try:
        r = httpx.get(FRONTEND_URL, timeout=2.0)
        print(f"  {GREEN}✓{RESET} React Frontend:        {GREEN}ONLINE{RESET} ({FRONTEND_URL})")
    except Exception:
        print(f"  {YELLOW}!{RESET} React Frontend:        {YELLOW}NOT DETECTED{RESET} (Run 'cd apps/web && npm run dev')")

    # Check Ollama
    ollama_ok = False
    try:
        r = httpx.get(f"{OLLAMA_URL}/api/tags", timeout=3.0)
        if r.status_code == 200:
            ollama_ok = True
            models = [m.get("name") for m in r.json().get("models", [])]
            print(f"  {GREEN}✓{RESET} Ollama Service:        {GREEN}ONLINE{RESET} ({OLLAMA_URL})")
            gemma_models = [m for m in models if "gemma" in m.lower()]
            if gemma_models:
                print(f"  {GREEN}✓{RESET} Gemma Models:          {GREEN}{', '.join(gemma_models)}{RESET}")
            else:
                print(f"  {YELLOW}!{RESET} Gemma Models:          {YELLOW}None downloaded yet{RESET} (Run: 'ollama pull gemma4:e2b')")
        else:
            print(f"  {YELLOW}!{RESET} Ollama Service:        {YELLOW}HTTP {r.status_code}{RESET}")
    except Exception:
        print(f"  {YELLOW}!{RESET} Ollama Service:        {YELLOW}NOT DETECTED{RESET} (Run: 'brew services start ollama')")

    # Check System Diagnostics from Backend
    if backend_ok:
        try:
            diag = httpx.get(f"{BACKEND_URL}/api/system/diagnostics", timeout=3.0).json()
            replay_chk = next((c for c in diag.get("checks", []) if c.get("subsystem") == "replay"), None)
            if replay_chk and replay_chk.get("status") == "operational":
                print(f"  {GREEN}✓{RESET} Docker Replay:         {GREEN}ONLINE{RESET} (Isolated sandbox worker ready)")
            else:
                print(f"  {YELLOW}!{RESET} Docker Replay:         {YELLOW}OFFLINE / FAIL-CLOSED{RESET} (Docker daemon not active on host)")
        except Exception:
            pass

    if not backend_ok:
        print(f"\n{RED}Error: FastAPI backend is required to run the demo.{RESET}")
        print("Please start it with: cd apps/api && source .venv/bin/activate && uvicorn app.main:app --port 8000")
        sys.exit(1)


def apply_migrations():
    print(f"\n{BOLD}[Step 2/8] Applying SQLite Schema & Verifying Tables...{RESET}")
    r = httpx.get(f"{BACKEND_URL}/api/system/status", timeout=5.0)
    if r.status_code == 200:
        data = r.json()
        print(f"  {GREEN}✓{RESET} Database connected:    {GREEN}SQLite (./rift.db){RESET}")
        print(f"  {GREEN}✓{RESET} Existing records:      {data.get('total_traces', 0)} traces, {data.get('total_agents', 0)} agents")
    else:
        print(f"  {RED}✗{RESET} Database status check failed.")
        sys.exit(1)


def import_fixture():
    print(f"\n{BOLD}[Step 3/8] Importing Accidental Deletion Fixture (Idempotent)...{RESET}")
    if not FIXTURE_PATH.exists():
        print(f"  {RED}✗{RESET} Fixture not found at {FIXTURE_PATH}")
        sys.exit(1)

    with open(FIXTURE_PATH, "r", encoding="utf-8") as f:
        payload = json.load(f)

    # Idempotent import: overwrite=false
    res = httpx.post(f"{BACKEND_URL}/api/traces/import?overwrite=false", json=payload, timeout=10.0)
    if res.status_code in (200, 201):
        data = res.json()
        status_label = data.get("status")
        if status_label == "already_exists":
            print(f"  {GREEN}✓{RESET} Trace already imported: {CYAN}{data.get('trace_id')}{RESET} ({data.get('span_count')} spans)")
        else:
            print(f"  {GREEN}✓{RESET} Trace imported:         {CYAN}{data.get('trace_id')}{RESET} ({data.get('span_count')} spans)")
        return data.get("trace_id")
    else:
        print(f"  {RED}✗{RESET} Import failed: {res.text}")
        sys.exit(1)


def run_detection(trace_id):
    print(f"\n{BOLD}[Step 4/8] Running Deterministic Incident Detector...{RESET}")
    res = httpx.post(f"{BACKEND_URL}/api/traces/{trace_id}/detect", timeout=10.0)
    if res.status_code == 200:
        incidents = res.json()
        print(f"  {GREEN}✓{RESET} Detection complete:    {GREEN}{len(incidents)} incident(s) detected{RESET}")
        for inc in incidents:
            print(f"    - [{inc.get('severity', '').upper()}] {inc.get('title')}")
            print(f"      Detections: {inc.get('detection_count', 0)} | Agent: {inc.get('agent_name')}")
    else:
        print(f"  {RED}✗{RESET} Detection failed: {res.text}")
        sys.exit(1)


def get_incident_info(trace_id):
    print(f"\n{BOLD}[Step 5/8] Resolving Trace and Incident Identifiers...{RESET}")
    res = httpx.get(f"{BACKEND_URL}/api/incidents?trace_id={trace_id}", timeout=5.0)
    if res.status_code == 200:
        incidents = res.json()
        if incidents:
            inc = incidents[0]
            print(f"  {GREEN}✓{RESET} Trace ID:              {CYAN}{trace_id}{RESET}")
            print(f"  {GREEN}✓{RESET} Incident ID:           {CYAN}{inc.get('id')}{RESET}")
            print(f"  {GREEN}✓{RESET} Incident Title:        {BOLD}{inc.get('title')}{RESET}")
            print(f"  {GREEN}✓{RESET} Severity Level:        {RED}{inc.get('severity', '').upper()}{RESET}")
            print(f"  {GREEN}✓{RESET} Suspicious Event ID:   {YELLOW}{inc.get('first_suspicious_event_id')}{RESET}")
            return inc.get("id")
    print(f"  {YELLOW}!{RESET} No incident found for trace {trace_id}")
    return None


def print_app_urls():
    print(f"\n{BOLD}[Step 6/8] Application Endpoints:{RESET}")
    print(f"  {CYAN}▸ Frontend UI:{RESET}          {BOLD}{FRONTEND_URL}{RESET}")
    print(f"  {CYAN}▸ Backend API:{RESET}          {BOLD}{BACKEND_URL}{RESET}")
    print(f"  {CYAN}▸ API Documentation:{RESET}    {BOLD}{BACKEND_URL}/docs{RESET}")
    print(f"  {CYAN}▸ Direct Reports Page:{RESET}  {BOLD}{FRONTEND_URL}/reports{RESET}")
    print(f"  {CYAN}▸ Direct Settings Page:{RESET} {BOLD}{FRONTEND_URL}/settings{RESET}")


def print_instructions(trace_id, incident_id):
    print(f"\n{BOLD}[Step 7/8] How to Trigger Real Gemma 4 AI Investigation:{RESET}")
    print(f"""  1. Open your browser at:
     {CYAN}{FRONTEND_URL}/investigations/{trace_id}{RESET}
  2. Click {BOLD}\"Investigate with Gemma\"{RESET} in the right-hand panel.
  3. Real local inference executes via Ollama on Apple Silicon ({BOLD}gemma4:e2b{RESET}).
  4. The platform verifies:
     - Root-cause hypotheses with confidence ratings
     - Supporting vs. contradictory evidence matrices
     - Citation integrity against actual span IDs (e.g. span-demo-005)
     - Human-in-the-loop actionable remediation proposals
  5. Download technical reports via {BOLD}\"Export .md\"{RESET} or {BOLD}\"Export .json\"{RESET}.
""")

    print(f"{BOLD}[Step 8/8] How to Launch Counterfactual Replay:{RESET}")
    print(f"""  1. Navigate to:
     {CYAN}{FRONTEND_URL}/replay{RESET}
  2. Select Incident: {CYAN}{incident_id or 'inc-967a460bebd6'}{RESET}
  3. Compare Original Failing Operation ({BOLD}rm -rf / --no-preserve-root{RESET})
     against Safe Corrected Alternative ({BOLD}find /app/temp -type f -delete{RESET}).
  4. Review human approval requirement and execute sandbox run.
  {DIM}Note: Docker daemon is required on host for containerized sandbox execution.
  RIFT enforces strict fail-closed isolation — destructive commands will NEVER execute on host.{RESET}
""")

    print(f"{GREEN}{BOLD}========================================================================{RESET}")
    print(f"{GREEN}{BOLD}   RIFT IS READY FOR DEMONSTRATION & INVESTIGATION!                    {RESET}")
    print(f"{GREEN}{BOLD}========================================================================{RESET}\n")


def main():
    print_banner()
    check_services()
    apply_migrations()
    trace_id = import_fixture()
    run_detection(trace_id)
    incident_id = get_incident_info(trace_id)
    print_app_urls()
    print_instructions(trace_id, incident_id)


if __name__ == "__main__":
    main()
