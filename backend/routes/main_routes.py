from flask import Blueprint, jsonify

main_bp = Blueprint("main", __name__, url_prefix="/api")


@main_bp.route("/health")
def health():
    return jsonify({"status": "ok"})
