from flask import Blueprint, request, jsonify
import sqlite3
import bcrypt

from backend.db import get_db
from backend.auth import create_token, auth_required

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

DESIGNATIONS = [
    "Officer", "Senior Officer", "Assistant Manager", "Manager",
    "Senior Manager", "Chief Manager", "Deputy General Manager", "General Manager",
]


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    name = (data.get("name") or "").strip()
    designation = (data.get("designation") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name:
        return jsonify({"error": "Name is required"}), 400
    if designation not in DESIGNATIONS:
        return jsonify({"error": "Invalid designation"}), 400
    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO users (name, designation, email, password_hash) VALUES (?, ?, ?, ?)",
            (name, designation, email, password_hash),
        )
        conn.commit()
        user_id = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()["id"]
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"error": "Email already registered"}), 409
    conn.close()

    token = create_token(user_id)
    resp = jsonify({"user": {"id": user_id, "name": name, "designation": designation, "email": email}})
    resp.set_cookie("token", token, httponly=True, samesite="Lax", max_age=86400)
    return resp, 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()

    if not user or not bcrypt.checkpw(password.encode(), user["password_hash"].encode()):
        return jsonify({"error": "Invalid email or password"}), 401

    token = create_token(user["id"])
    resp = jsonify({"user": {"id": user["id"], "name": user["name"], "designation": user["designation"], "email": user["email"]}})
    resp.set_cookie("token", token, httponly=True, samesite="Lax", max_age=86400)
    return resp


@auth_bp.route("/logout", methods=["POST"])
def logout():
    resp = jsonify({"message": "Logged out"})
    resp.delete_cookie("token")
    return resp


@auth_bp.route("/me")
@auth_required
def me():
    return jsonify({"user": request.user})
