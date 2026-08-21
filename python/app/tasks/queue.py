import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


@dataclass
class Job:
    job_id: str
    playbook: str
    thread: Optional[threading.Thread] = None
    runner: Any = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    _stdout_lines: List[str] = field(default_factory=list)
    _stderr_lines: List[str] = field(default_factory=list)
    _lock: threading.Lock = field(default_factory=threading.Lock)
    finished_at: Optional[datetime] = None

    def append_stdout(self, text: str) -> None:
        if not text:
            return
        with self._lock:
            self._stdout_lines.append(text)

    def mark_finished(self) -> None:
        with self._lock:
            self.finished_at = datetime.now(timezone.utc)

    def snapshot(self) -> tuple:
        with self._lock:
            return ("".join(self._stdout_lines), "".join(self._stderr_lines), self.finished_at)


class JobRegistry:
    def __init__(self) -> None:
        self._jobs: Dict[str, Job] = {}
        self._lock = threading.Lock()

    def register(self, job: Job) -> None:
        with self._lock:
            self._jobs[job.job_id] = job

    def get(self, job_id: str) -> Optional[Job]:
        with self._lock:
            return self._jobs.get(job_id)

    def status(self, job_id: str) -> Optional[Dict[str, Any]]:
        job = self.get(job_id)
        if job is None:
            return None

        stdout, stderr, finished_at = job.snapshot()
        payload: Dict[str, Any] = {
            "job_id": job.job_id,
            "playbook": job.playbook,
            "status": "running",
            "rc": None,
            "stdout": stdout,
            "stderr": stderr,
            "duration_ms": None,
        }
        if job.thread is None or job.thread.is_alive():
            return payload

        rc = _runner_rc(job.runner)
        payload["status"] = "successful" if rc == 0 else "failed"
        payload["rc"] = rc
        end = finished_at or datetime.now(timezone.utc)
        payload["duration_ms"] = int((end - job.created_at).total_seconds() * 1000)
        return payload


def _runner_rc(runner: Any) -> int:
    try:
        return int(runner.rc)
    except (AttributeError, TypeError, ValueError):
        return -1
