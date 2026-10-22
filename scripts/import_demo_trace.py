#!/usr/bin/env python3
"""
Imports the realistic accidental-deletion incident trace fixture
into the running RIFT FastAPI backend API.
"""

import sys
import json
import httpx
from pathlib import Path

FIXTURE_PATH = Path(__file__).resolve().parent.parent / "fixtures" / "incidents" / "accidental-deletion.json"
DEFAULT_API_URL = "http://localhost:8000/api/traces/import"


def main():
    api_url = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_API_URL
    print(f"[*] Reading demo trace fixture from: {FIXTURE_PATH}")
    if not FIXTURE_PATH.exists():
        print(f"[!] Error: Fixture not found at {FIXTURE_PATH}")
        sys.exit(1)

    with open(FIXTURE_PATH, "r", encoding="utf-8") as f:
        payload = json.load(f)

    print(f"[*] Importing trace '{payload['trace']['id']}' ({len(payload.get('spans', []))} spans) to {api_url}...")
    try:
        response = httpx.post(f"{api_url}?overwrite=true", json=payload, timeout=10.0)
        if response.status_code in (200, 201):
            data = response.json()
            print(f"[+] Success! {data.get('message', 'Imported successfully')}")
            print(f"    Trace ID:   {data.get('trace_id')}")
            print(f"    Span count: {data.get('span_count')}")
            print(f"    Status:     {data.get('status')}")
        else:
            print(f"[!] Server returned HTTP {response.status_code}: {response.text}")
            sys.exit(1)
    except Exception as e:
        print(f"[!] Failed to connect to RIFT API: {e}")
        print("    Ensure the backend is running at http://localhost:8000")
        sys.exit(1)


if __name__ == "__main__":
    main()
