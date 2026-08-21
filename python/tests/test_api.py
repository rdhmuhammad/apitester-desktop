import sys
import threading
import types

import pytest

from app import create_app


class FakeRunner:
    def __init__(self):
        self.rc = 0


@pytest.fixture
def app(tmp_path, monkeypatch):
    (tmp_path / "project").mkdir()
    (tmp_path / "project" / "deploy.yml").write_text("- hosts: all\n  tasks: []\n")
    (tmp_path / "inventory").mkdir()
    (tmp_path / "inventory" / "hosts.json").write_text('{"all": {"hosts": {"127.0.0.1": {}}}}')

    fake_module = types.ModuleType("ansible_runner")

    def fake_run_async(**kwargs):
        thread = threading.Thread(target=lambda: None)
        thread.start()
        return thread, FakeRunner()

    fake_module.run_async = fake_run_async
    monkeypatch.setitem(sys.modules, "ansible_runner", fake_module)

    app = create_app()
    app.config.update(ANSIBLE_RUNNER_DIR=str(tmp_path), TESTING=True)
    return app


@pytest.fixture
def client(app):
    return app.test_client()


def test_run_and_status(client):
    response = client.post(
        "/api/v1/jobs/run",
        json={"playbook": "deploy.yml", "extra_vars": {"app_version": "v2.1.0"}},
    )
    assert response.status_code == 202
    body = response.get_json()
    assert body["status"] == "starting"
    assert body["job_id"]

    status = client.get(f"/api/v1/jobs/{body['job_id']}")
    assert status.status_code == 200
    payload = status.get_json()
    assert payload["job_id"] == body["job_id"]
    assert payload["status"] in {"running", "successful"}


def test_unknown_playbook(client):
    response = client.post("/api/v1/jobs/run", json={"playbook": "missing.yml"})
    assert response.status_code == 400
    assert response.get_json()["error"] == "invalid_request"


def test_invalid_payload(client):
    response = client.post("/api/v1/jobs/run", json={"playbook": ""})
    assert response.status_code == 400
    assert response.get_json()["error"] == "validation_error"


def test_status_not_found(client):
    response = client.get("/api/v1/jobs/does-not-exist")
    assert response.status_code == 404


def test_runner_unavailable(client, monkeypatch):
    from app.services.runner_service import RunnerUnavailableError

    def raise_unavailable(**kwargs):
        raise RunnerUnavailableError("ansible-runner unavailable")

    monkeypatch.setattr("app.services.runner_service._run_async", raise_unavailable)

    response = client.post("/api/v1/jobs/run", json={"playbook": "deploy.yml"})
    assert response.status_code == 503
    assert response.get_json()["error"] == "runner_unavailable"
