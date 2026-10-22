import os
import shutil
import subprocess
from pathlib import Path
from typing import Dict, Any


class SandboxUnavailableError(RuntimeError):
    """Raised when secure container sandbox cannot be established."""
    pass


class SandboxOrchestrator:
    @staticmethod
    def is_docker_available() -> bool:
        """Checks if Docker command or Docker daemon socket is available."""
        # 1. Check for docker binary on PATH
        docker_bin = shutil.which("docker")
        if not docker_bin:
            return False

        # 2. Check if docker daemon responds
        try:
            res = subprocess.run(
                ["docker", "info"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=3,
            )
            return res.returncode == 0
        except Exception:
            return False

    @classmethod
    def get_capabilities(cls) -> Dict[str, Any]:
        docker_ready = cls.is_docker_available()

        return {
            "available": docker_ready,
            "runtime": "docker" if docker_ready else "none",
            "message": (
                "Docker container sandbox is ready for isolated replay."
                if docker_ready else
                "Secure replay is unavailable in this environment."
            ),
            "reason": (
                None
                if docker_ready else
                "Docker daemon is not running or not installed. In accordance with RIFT security architecture, untrusted code will not execute on the host."
            ),
            "supported_operations": [
                "delete_file",
                "write_file",
                "move_file",
                "run_validation",
            ],
            "setup_instructions": (
                "1. Install Docker Desktop: https://www.docker.com/products/docker-desktop\n"
                "2. Start Docker service\n"
                "3. Build worker image: docker build -t rift-replay-worker:latest workers/replay/"
            ),
            "security_constraints": {
                "no_host_execution": True,
                "unprivileged_user": "10001:10001",
                "network_mode": "none",
                "read_only_root": True,
                "cap_drop": ["ALL"],
                "memory_limit": "256m",
                "cpu_limit": 1.0,
                "timeout_seconds": 30,
            },
        }
