from functools import wraps
from flask import request, jsonify, current_app
import jwt
import datetime

from backend.db import get_db


def create_token(user_id):
    payload = {
        "sub": str(user_id),
        "iat": datetime.datetime.now(datetime.timezone.utc),
        "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=24),
    }
    return jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm="HS256")


def auth_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.cookies.get("token")
        if not token:
            return jsonify({"error": "Authentication required"}), 401
        try:
            payload = jwt.decode(token, current_app.config["SECRET_KEY"], algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        conn = get_db()
        user = conn.execute("SELECT id, name, designation, email FROM users WHERE id = ?", (int(payload["sub"]),)).fetchone()
        conn.close()
        if not user:
            return jsonify({"error": "User not found"}), 401

        request.user = dict(user)
        return f(*args, **kwargs)

    return decorated
