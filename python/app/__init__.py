from dotenv import load_dotenv
from flask import Flask, jsonify

import app.compat  # noqa: F401  (installs POSIX module shims on Windows)

from app.config import Config


def create_app(config_object=None):
    load_dotenv()
    app = Flask(__name__)
    app.config.from_object(config_object or Config)

    from app.api.routes import bp as jobs_bp
    from app.services.runner_service import RunnerUnavailableError

    app.register_blueprint(jobs_bp, url_prefix="/api/v1")

    @app.errorhandler(RunnerUnavailableError)
    def handle_runner_unavailable(exc):
        return jsonify({"error": "runner_unavailable", "detail": str(exc)}), 503

    return app
