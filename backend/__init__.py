from flask import Flask, send_from_directory
from flask_cors import CORS
import os

from backend.config import Config
from backend.db import init_db
from backend.routes import all_blueprints


def create_app():
    app = Flask(
        __name__,
        static_folder=os.path.join(os.path.dirname(__file__), "..", "static"),
        static_url_path="",
        instance_path=os.path.join(os.path.dirname(__file__), "..", "instance"),
    )
    app.config.from_object(Config)
    CORS(app, supports_credentials=True)

    for bp in all_blueprints:
        app.register_blueprint(bp)

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_react(path):
        if path and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        return send_from_directory(app.static_folder, "index.html")

    with app.app_context():
        init_db()

    return app
