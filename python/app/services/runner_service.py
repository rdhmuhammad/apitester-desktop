import os
import platform
import shutil
import subprocess
from pathlib import Path
from typing import Any, Dict, Optional

from flask import current_app

import app.compat  # noqa: F401  (installs POSIX module shims on Windows)

from app.tasks.queue import Job, JobRegistry

registry = JobRegistry()


class RunnerUnavailableError(RuntimeError):
    pass


def _run_async(**options):
    try:
        import ansible_runner
    except ImportError as exc:
        raise RunnerUnavailableError(f"ansible-runner could not be imported on this control node: {exc}") from exc
    app.compat.patch_ansible_runner()
    return ansible_runner.run_async(**options)


def _root() -> Path:
    return Path(current_app.config["ANSIBLE_RUNNER_DIR"]).resolve()


def _playbook_path(playbook_name: str) -> Path:
    candidate = Path(playbook_name)
    if candidate.is_absolute():
        if not candidate.is_file():
            raise FileNotFoundError(f"playbook not found: {playbook_name}")
        return candidate

    root = _root()
    project = root / "project"
    if not project.is_dir():
        raise FileNotFoundError(f"project directory not found: {project}")

    playbook = (project / playbook_name).resolve()
    if project not in playbook.parents:
        raise ValueError("playbook path escapes the project directory")
    if not playbook.is_file():
        raise FileNotFoundError(f"playbook not found: {playbook_name}")
    return playbook


def _inventory_path(inventory: str) -> Path:
    candidate = Path(inventory)
    if candidate.is_absolute():
        if not candidate.is_file():
            raise FileNotFoundError(f"inventory not found: {inventory}")
        return candidate

    root = _root()
    inventory_dir = root / "inventory"
    path = (inventory_dir / inventory).resolve()
    if inventory_dir not in path.parents:
        raise ValueError("inventory path escapes the inventory directory")
    if not path.is_file():
        raise FileNotFoundError(f"inventory not found: {inventory}")
    return path


def _collections_path(root: Path) -> Path:
    project_collections = root / "project" / "collections"
    if project_collections.is_dir():
        return project_collections
    return root / "collections"


def _build_cmdline(*, limit: Optional[str], tags: Optional[str], check_mode: bool, diff_mode: bool) -> Optional[str]:
    parts = []
    if limit:
        parts.append(f"--limit {limit}")
    if tags:
        parts.append(f"--tags {tags}")
    if check_mode:
        parts.append("--check")
    if diff_mode:
        parts.append("--diff")
    return " ".join(parts) if parts else None


def trigger_playbook_async(
    job_id: str,
    playbook_name: str,
    inventory: Optional[str] = None,
    extra_vars: Optional[Dict[str, Any]] = None,
    limit: Optional[str] = None,
    tags: Optional[str] = None,
    check_mode: bool = False,
    diff_mode: bool = False,
):
    playbook = _playbook_path(playbook_name)
    root = _root()

    job = Job(job_id=job_id, playbook=playbook_name)

    def handle_event(event):
        if not isinstance(event, dict):
            return
        stdout = event.get("stdout")
        if stdout:
            job.append_stdout(stdout)

    envvars = {
        "ANSIBLE_COLLECTIONS_PATH": str(_collections_path(root)),
    }
    if os   .name == "nt":
        powershell = shutil.which("powershell.exe")
        if powershell:
            # The local connection uses this value to launch local commands.
            envvars["ANSIBLE_EXECUTABLE"] = powershell

    options: Dict[str, Any] = {
        "private_data_dir": str(root),
        "playbook": str(playbook),
        "extravars": extra_vars or {},
        "ident": job_id,
        "quiet": False,
        "event_handler": handle_event,
        "cancel_callback": job.cancel_requested.is_set,
        "finished_callback": lambda _runner: job.mark_finished(),
        "envvars": envvars,
    }
    rotate = current_app.config.get("ANSIBLE_ROTATE_ARTIFACTS", 0)
    if rotate > 0:
        options["rotate_artifacts"] = rotate
    if inventory:
        options["inventory"] = str(_inventory_path(inventory))
    cmdline = _build_cmdline(limit=limit, tags=tags, check_mode=check_mode, diff_mode=diff_mode)
    if cmdline:
        options["cmdline"] = cmdline
    if current_app.config.get("ANSIBLE_PROCESS_ISOLATION"):
        options["process_isolation"] = True

    thread, runner = _run_async(**options)
    job.thread = thread
    job.runner = runner
    registry.register(job)
    return runner


def get_job_status(job_id: str):
    return registry.status(job_id)


def cancel_job(job_id: str):
    return registry.request_cancel(job_id)


def _ansible_version() -> str:
    try:
        from importlib.metadata import version

        return version("ansible-core") or ""
    except Exception:
        pass
    try:
        output = subprocess.run(
            ["ansible", "--version"], capture_output=True, text=True, timeout=10
        ).stdout
        return output.splitlines()[0] if output else ""
    except Exception:
        return ""


def get_runtime_info() -> Dict[str, Any]:
    name = "Managed Ansible runner"
    try:
        import ansible_runner  # noqa: F401
    except ImportError as exc:
        return {
            "available": False,
            "name": name,
            "version": "",
            "python_version": "",
            "binary": "",
            "message": f"ansible-runner could not be imported on this control node: {exc}",
        }
    app.compat.patch_ansible_runner()

    return {
        "available": True,
        "name": name,
        "version": _ansible_version(),
        "python_version": platform.python_version(),
        "binary": shutil.which("ansible-playbook") or "",
        "message": "ansible-runner is available",
    }
