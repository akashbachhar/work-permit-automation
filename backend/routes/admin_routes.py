from functools import wraps
from flask import Blueprint, request, jsonify, current_app
import bcrypt
import jwt
import datetime

from backend.db import get_db

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


def create_admin_token(admin_id):
    payload = {
        "sub": str(admin_id),
        "role": "admin",
        "iat": datetime.datetime.now(datetime.timezone.utc),
        "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=12),
    }
    return jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm="HS256")


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.cookies.get("admin_token")
        if not token:
            return jsonify({"error": "Admin authentication required"}), 401
        try:
            payload = jwt.decode(token, current_app.config["SECRET_KEY"], algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        if payload.get("role") != "admin":
            return jsonify({"error": "Admin access required"}), 403

        conn = get_db()
        admin = conn.execute("SELECT id, username FROM admins WHERE id = ?", (int(payload["sub"]),)).fetchone()
        conn.close()
        if not admin:
            return jsonify({"error": "Admin not found"}), 401

        request.admin = dict(admin)
        return f(*args, **kwargs)

    return decorated


@admin_bp.route("/login", methods=["POST"])
def admin_login():
    data = request.get_json()
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    conn = get_db()
    admin = conn.execute("SELECT * FROM admins WHERE username = ?", (username,)).fetchone()
    conn.close()

    if not admin or not bcrypt.checkpw(password.encode(), admin["password_hash"].encode()):
        return jsonify({"error": "Invalid credentials"}), 401

    token = create_admin_token(admin["id"])
    resp = jsonify({"admin": {"id": admin["id"], "username": admin["username"]}})
    resp.set_cookie("admin_token", token, httponly=True, samesite="Lax", max_age=43200)
    return resp


@admin_bp.route("/logout", methods=["POST"])
def admin_logout():
    resp = jsonify({"message": "Logged out"})
    resp.delete_cookie("admin_token")
    return resp


@admin_bp.route("/me")
@admin_required
def admin_me():
    return jsonify({"admin": request.admin})


@admin_bp.route("/change-credentials", methods=["PUT"])
@admin_required
def change_credentials():
    data = request.get_json()
    new_username = (data.get("username") or "").strip()
    new_password = data.get("password") or ""
    current_password = data.get("current_password") or ""

    if not current_password:
        return jsonify({"error": "Current password is required"}), 400

    conn = get_db()
    admin = conn.execute("SELECT * FROM admins WHERE id = ?", (request.admin["id"],)).fetchone()

    if not bcrypt.checkpw(current_password.encode(), admin["password_hash"].encode()):
        conn.close()
        return jsonify({"error": "Current password is incorrect"}), 401

    if new_username:
        conn.execute("UPDATE admins SET username = ? WHERE id = ?", (new_username, request.admin["id"]))
    if new_password:
        if len(new_password) < 6:
            conn.close()
            return jsonify({"error": "New password must be at least 6 characters"}), 400
        pw_hash = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
        conn.execute("UPDATE admins SET password_hash = ? WHERE id = ?", (pw_hash, request.admin["id"]))

    conn.commit()
    conn.close()

    return jsonify({"message": "Credentials updated"})


@admin_bp.route("/users")
@admin_required
def list_users():
    conn = get_db()
    users = conn.execute("SELECT id, email, password_hash, created_at FROM users ORDER BY id").fetchall()
    conn.close()
    return jsonify({"users": [dict(u) for u in users]})


@admin_bp.route("/users/<int:user_id>", methods=["DELETE"])
@admin_required
def delete_user(user_id):
    conn = get_db()
    conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "User deleted"})


@admin_bp.route("/order-types")
@admin_required
def get_order_types():
    from backend.routes.work_order_routes import ORDER_TYPES
    types = [{"code": k, "description": v} for k, v in ORDER_TYPES.items()]
    return jsonify({"order_types": types})


@admin_bp.route("/work-orders")
@admin_required
def list_work_orders():
    conn = get_db()
    orders = conn.execute(
        "SELECT id, order_no, order_type, order_type_desc, priority, description, created_by, created_at FROM work_orders ORDER BY id DESC"
    ).fetchall()
    conn.close()
    return jsonify({"work_orders": [dict(o) for o in orders]})


@admin_bp.route("/work-orders/<int:order_id>", methods=["DELETE"])
@admin_required
def delete_work_order(order_id):
    conn = get_db()
    conn.execute("DELETE FROM work_orders WHERE id = ?", (order_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Work order deleted"})


@admin_bp.route("/work-orders", methods=["POST"])
@admin_required
def create_work_order():
    from backend.routes.work_order_routes import ORDER_TYPES, BASE_ORDER_NO

    data = request.get_json()
    order_type = (data.get("order_type") or "").strip()
    priority = (data.get("priority") or "").strip()
    description = (data.get("description") or "").strip()

    if not order_type or not priority or not description:
        return jsonify({"error": "All fields are required"}), 400
    if order_type not in ORDER_TYPES:
        return jsonify({"error": "Invalid order type"}), 400
    if priority not in ("Safety Critical", "High", "Medium", "Low"):
        return jsonify({"error": "Invalid priority"}), 400

    conn = get_db()
    last = conn.execute("SELECT order_no FROM work_orders ORDER BY id DESC LIMIT 1").fetchone()
    next_no = str(int(last["order_no"]) + 1) if last else str(BASE_ORDER_NO)

    conn.execute(
        "INSERT INTO work_orders (order_no, order_type, order_type_desc, priority, description, created_by) VALUES (?, ?, ?, ?, ?, ?)",
        (next_no, order_type, ORDER_TYPES[order_type], priority, description, f"admin:{request.admin['username']}"),
    )
    conn.commit()
    conn.close()
    return jsonify({"order_no": next_no, "message": "Work order created"}), 201


@admin_bp.route("/work-orders/<int:order_id>", methods=["PUT"])
@admin_required
def update_work_order(order_id):
    from backend.routes.work_order_routes import ORDER_TYPES

    data = request.get_json()
    order_type = (data.get("order_type") or "").strip()
    priority = (data.get("priority") or "").strip()
    description = (data.get("description") or "").strip()

    if not order_type or not priority or not description:
        return jsonify({"error": "All fields are required"}), 400
    if order_type not in ORDER_TYPES:
        return jsonify({"error": "Invalid order type"}), 400
    if priority not in ("Safety Critical", "High", "Medium", "Low"):
        return jsonify({"error": "Invalid priority"}), 400

    conn = get_db()
    conn.execute(
        "UPDATE work_orders SET order_type = ?, order_type_desc = ?, priority = ?, description = ? WHERE id = ?",
        (order_type, ORDER_TYPES[order_type], priority, description, order_id),
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Work order updated"})
