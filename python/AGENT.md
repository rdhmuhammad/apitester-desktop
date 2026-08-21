# Ansible & Flask Integration Guide

This document consolidates the complete conversation, configurations, architecture insights, and project README for integrating Ansible with a Flask API.

---

## 1. Ansible INI Inventory Configuration Examples

### 1.1 Multi-Host Inventory with Credentials (Group Variables)

```ini
[webservers]
web1.example.com
web2.example.com

[dbservers]
db1.example.com

# Apply credentials to all hosts in the 'webservers' group
[webservers:vars]
ansible_user=ubuntu
ansible_ssh_private_key_file=~/.ssh/id_rsa
ansible_python_interpreter=/usr/bin/python3

# Apply credentials to all hosts in the 'dbservers' group
[dbservers:vars]
ansible_user=postgres
ansible_password=SecurePassword123!
ansible_port=2222

# Apply global credentials/variables across ALL hosts in the inventory
[all:vars]
ansible_ssh_common_args='-o StrictHostKeyChecking=no'
```

**Key Notes:**
- **Group variables (`[groupname:vars]`):** Keeps credentials clean and grouped by server role rather than repeating them on every single host line.
- **Security tip:** Hardcoding plain-text passwords (`ansible_password`) in an inventory file is insecure. Use **Ansible Vault** (`ansible-vault encrypt`) or SSH key-based authentication (`ansible_ssh_private_key_file`) whenever possible.

---

### 1.2 Single Server Inventory with Password Authentication

```ini
[all]
192.168.1.50 ansible_user=root ansible_password=YourSecretPassword123

[all:vars]
ansible_python_interpreter=/usr/bin/python3
ansible_ssh_common_args='-o StrictHostKeyChecking=no'
```

**Key Notes:**
- Replace `192.168.1.50` with your actual server IP or domain name.
- `ansible_ssh_common_args` prevents SSH host-key prompt errors on the first connection.
- **Security Note:** Storing plain-text passwords in an inventory file exposes credentials. For production environments, use **Ansible Vault** to encrypt sensitive data:
  ```bash
  ansible-vault encrypt inventory.ini
  ```

---

## 2. Integrating Flask with Ansible

### 2.1 Feasibility & Architectural Considerations

When bundling Ansible and a Flask API into a standalone binary (typically using tools like PyInstaller), Ansible can still execute playbooks, manage inventory, and interact with remote hosts via SSH. However, key architectural factors must be considered:

1. **Use `ansible-runner` (Recommended):**
   Ansible's internal Python API (`ansible.executor`, `ansible.playbook`) is **not public, unstable, and changes without notice** between versions. Red Hat's official **`ansible-runner`** package provides a stable interface to run playbooks asynchronously, stream logs, and handle execution state cleanly within Flask.

2. **Binary Bundling Complexity (PyInstaller / Nuitka):**
   Ansible relies heavily on dynamically loading plugins, modules, and external collections at runtime. When frozen into a binary:
    - Explicitly include Ansible's default collections and modules as data files/hidden imports in your build spec.
    - Package runtime dependencies (like `ssh`, `pysftp`, or `paramiko`) into the binary context.

3. **OS Support:**
   Ansible control nodes do **not** run natively on Windows. This service ships a Windows compatibility layer (`app/compat/`) that shims the POSIX-only pieces (see §4 below), so `ansible-runner` can drive `ansible-core` from a Windows control node. Without it, the binary would only run on Linux or macOS (or via WSL/Docker on Windows).

### 2.2 Minimal Flask API Example with `ansible-runner`

```python
from flask import Flask, jsonify, request
import ansible_runner
import os

app = Flask(__name__)

@app.route('/api/v1/deploy', methods=['POST'])
def run_playbook():
    data = request.json or {}
    target_host = data.get('host', '127.0.0.1')
    ssh_password = data.get('password')

    r = ansible_runner.run(
        private_data_dir='/tmp/ansible_run',
        playbook={
            'hosts': 'all',
            'tasks': [
                {'name': 'Ping host', 'ping': {}}
            ]
        },
        inventory={'all': {'hosts': {target_host: {'ansible_password': ssh_password, 'ansible_user': 'root'}}}},
        quiet=False
    )

    return jsonify({
        "status": r.status,
        "rc": r.rc,
        "stats": r.stats
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

---

## 3. Medium-Scale Application README

```markdown
# Flask Ansible Runner API

A modular, application-factory pattern Flask API designed for medium-scale automation, integrated with `ansible-runner` to execute playbooks asynchronously without blocking API threads.

## Project Structure

```text
flask-ansible-service/
├── app/
│   ├── __init__.py          # Application factory (create_app)
│   ├── config.py            # Environment settings
│   ├── api/                 # API Endpoints (Blueprints)
│   │   ├── __init__.py
│   │   ├── routes.py        # Automation triggers & status routes
│   │   └── schemas.py       # Marshmallow/Pydantic validation schemas
│   ├── services/            # Business logic layer
│   │   ├── __init__.py
│   │   └── runner_service.py # Wrapper for ansible-runner execution
│   └── tasks/               # Background task queues (Celery/Redis)
│       └── queue.py
├── ansible_data/            # Private data directory for ansible-runner
│   ├── env/                 # Environment variables and SSH passphrases
│   ├── inventory/           # Dynamic or static inventory files
│   │   └── hosts.json
│   └── project/             # Ansible playbooks and roles
│       ├── deploy.yml
│       └── roles/
├── tests/
├── .env.example
├── requirements.txt
└── wsgi.py                  # Entrypoint for Gunicorn/uWSGI
```

## Prerequisites

* **Control Host OS:** Linux or macOS are native; Windows works via the compatibility layer in §4.
* **Python:** 3.10+
* **System Tools:** OpenSSH client, `sshpass` (if using password authentication)

## Quick Start

1. **Clone repository and set up virtual environment:**
   ```bash
   git clone https://github.com/your-org/flask-ansible-service.git
   cd flask-ansible-service
   python3 -m venv venv
   source venv/bin/activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure Environment:**
   ```bash
   cp .env.example .env
   ```
   Set your `FLASK_ENV`, `SECRET_KEY`, and `ANSIBLE_RUNNER_DIR` inside `.env`.

4. **Initialize Private Data Directory:**
   ```bash
   mkdir -p ansible_data/{env,inventory,project}
   ```

5. **Run Development Server:**
   ```bash
   flask run --host=0.0.0.0 --port=5000
   ```

## API Endpoint Usage

### Trigger Playbook Run

`POST /api/v1/jobs/run`

**Request Body:**
```json
{
  "playbook": "deploy.yml",
  "inventory": "hosts.json",
  "extra_vars": {
    "target_host": "10.0.0.12",
    "app_version": "v2.1.0"
  }
}
```

**Response (202 Accepted):**
```json
{
  "job_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "status": "starting"
}
```

### Check Job Status

`GET /api/v1/jobs/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d`

**Response (200 OK):**
```json
{
  "job_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "status": "successful",
  "rc": 0
}
```

## `ansible-runner` Integration Pattern

Execution logic is wrapped in `app/services/runner_service.py` to prevent thread locking during long-running tasks:

```python
import ansible_runner
from flask import current_app

def trigger_playbook_async(playbook_name, extra_vars, job_id):
    """Executes an Ansible playbook asynchronously in the background."""
    thread, runner = ansible_runner.run_async(
        private_data_dir=current_app.config['ANSIBLE_RUNNER_DIR'],
        playbook=playbook_name,
        extravars=extra_vars,
        ident=job_id
    )
    return runner
```

## 4. Windows Compatibility Layer (`app/compat/`)

Ansible-core only supports POSIX control nodes, but this service runs on Windows. The fixes are the same ones `deployment/desktop/build-ansible-runtime.ps1` applies to the bundled runtime's site-packages; the dev venv applies them at runtime instead.

### 4.1 `app/compat/__init__.py`
- Sets `PYTHONUTF8=1` and prepends `app/compat` to `PYTHONPATH` so every child ansible interpreter auto-loads `sitecustomize.py`.
- Installs `sys.modules` shims for POSIX-only modules: `fcntl` (with an `_fd()` helper accepting int fds and file objects), `termios`, `pwd`, `grp`.
- `patch_ansible_runner()` — call after `import ansible_runner` (idempotent):
  - `pexpect.spawn` does not exist on win32 → substitutes `WindowsSpawn(PopenSpawn)` with the `isalive`/`close`/`terminate` API ansible-runner's `runner.py` needs.
  - `Runner.handle_termination` uses `os.getpgid`/`os.killpg` → replaced with an `os.kill(pid, 9)` version when those don't exist.

### 4.2 `app/compat/sitecustomize.py`
Loaded at startup by each child `ansible-playbook` process and its spawn workers:
- Locale check: `locale.getlocale()` reports UTF-8 when `PYTHONUTF8=1` (Windows locales are cp1252).
- `multiprocessing.get_context('fork')` falls back to `spawn` (no fork on Windows).
- No-ops for `os.register_at_fork`/`os.setsid`; `os.O_NONBLOCK = 0`.
- ctypes libc `wcwidth`/`wcswidth` stub for `ansible/utils/display.py`.
- Import hooks fix `ansible/parsing/dataloader.py` `RE_TASKS` (raw `os.path.sep` breaks the regex) and `ansible/_internal/_datatag/_tags.py` `Origin._post_validate` (`os.path.isabs` instead of `startswith('/')`).
- `WorkerProcess.run` calls `init_plugin_loader()` first — spawn workers are fresh interpreters that must reinstall the collection import finder.
- `ShellBase._normalize_system_tmpdirs` substitutes `tempfile.gettempdir()` for the POSIX `/tmp` defaults.
- `_wrapt.ObjectProxy` pickling: spawn serializes the whole `WorkerProcess` state, including `PluginInterposer`/`HostVars` proxies; `__reduce__`/`__reduce_ex__` restore the proxy around its wrapped object.

### 4.3 Gotchas
- **localhost targets** on Windows hit `C.DEFAULT_EXECUTABLE` (`/bin/sh`) in `plugins/connection/local.py`: pure action tasks (`debug`/`set_fact`/`assert`) work, but `command`/`shell`/`ping` do not. Real automation targets remote hosts via SSH.
- The compat layer assumes the service runs with a venv python whose `Scripts/` contains `ansible-playbook.exe` (same wheel set the build script bundles).

## Production Security Notes

* **Credential Management:** Avoid storing raw passwords or SSH private keys on disk. Dynamically populate `ansible_data/env/envvars` or pass credentials via secure environment variables retrieved from secret managers (e.g., HashiCorp Vault) at runtime.
* **Process Isolation:** Set `process_isolation=True` in `ansible-runner` options to execute playbooks inside isolated Docker/Podman container runtimes for security in multi-tenant environments.
```