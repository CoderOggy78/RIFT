import sys
from pathlib import Path

# Add repository root to sys.path for worker tests
repo_root = Path(__file__).resolve().parents[3]
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))
