import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-me")
    FLASK_ENV = os.getenv("FLASK_ENV", "development")
    ANSIBLE_RUNNER_DIR = os.getenv("ANSIBLE_RUNNER_DIR", str(BASE_DIR / "ansible_data"))
    ANSIBLE_ROTATE_ARTIFACTS = int(os.getenv("ANSIBLE_ROTATE_ARTIFACTS", "10"))
    ANSIBLE_PROCESS_ISOLATION = os.getenv("ANSIBLE_PROCESS_ISOLATION", "false").lower() in {"1", "true", "yes", "on"}
    MAX_CONCURRENT_JOBS = int(os.getenv("MAX_CONCURRENT_JOBS", "4"))
