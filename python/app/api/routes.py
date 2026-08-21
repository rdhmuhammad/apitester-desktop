import uuid

from flask import Blueprint, jsonify, request
from pydantic import ValidationError

from app.api.schemas import RunJobRequest
from app.services.runner_service import get_job_status, get_runtime_info, trigger_playbook_async

bp = Blueprint("jobs", __name__)


@bp.post("/jobs/run")
def run_job():
    try:
        payload = RunJobRequest.model_validate(request.get_json(silent=True) or {})
    except ValidationError as exc:
        return jsonify({"error": "validation_error", "detail": exc.errors()}), 400

    job_id = str(uuid.uuid4())
    try:
        trigger_playbook_async(
            job_id=job_id,
            playbook_name=payload.playbook,
            inventory=payload.inventory,
            extra_vars=payload.extra_vars,
            limit=payload.limit,
            tags=payload.tags,
            check_mode=payload.check_mode,
            diff_mode=payload.diff_mode,
        )
    except (FileNotFoundError, ValueError) as exc:
        return jsonify({"error": "invalid_request", "detail": str(exc)}), 400

    return jsonify({"job_id": job_id, "status": "starting"}), 202


@bp.get("/jobs/<job_id>")
def job_status(job_id):
    status = get_job_status(job_id)
    if status is None:
        return jsonify({"error": "not_found", "detail": f"job {job_id} not found"}), 404
    return jsonify(status), 200


@bp.get("/runtime")
def runtime():
    return jsonify(get_runtime_info()), 200
