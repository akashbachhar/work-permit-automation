from flask import Blueprint, request, jsonify

from backend.db import get_db
from backend.auth import auth_required

work_order_bp = Blueprint("work_order", __name__, url_prefix="/api/work-orders")

BASE_ORDER_NO = 110000100000

ORDER_TYPES = {
    "CU01": "CU Service Order",
    "CU02": "CU Service Order",
    "CU03": "CU Maintenance Order",
    "CU04": "CU Maintenance Order",
    "J3GE": "Owner order",
    "J3GV": "Administrator order",
    "PM01": "Corrective Maint.",
    "PM02": "Breakdown Maint.",
    "PM03": "Preventive Maint.",
    "PM04": "Refurbishment",
    "PM05": "Calibration",
    "PM06": "Shutdown / TA Maint.",
    "PM07": "Predictive Maint.",
    "PM08": "General Maint.",
    "PM09": "Improvement Activities",
    "PM10": "Inspection Report",
    "SM01": "Service order",
    "SM02": "Service order (with revenues)",
    "SM03": "Repair service",
}


@work_order_bp.route("/types")
@auth_required
def get_order_types():
    types = [{"code": k, "description": v} for k, v in ORDER_TYPES.items()]
    return jsonify({"order_types": types})


@work_order_bp.route("", methods=["POST"])
@auth_required
def create_work_order():
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
    if last:
        next_no = str(int(last["order_no"]) + 1)
    else:
        next_no = str(BASE_ORDER_NO)

    conn.execute(
        "INSERT INTO work_orders (order_no, order_type, order_type_desc, priority, description, created_by) VALUES (?, ?, ?, ?, ?, ?)",
        (next_no, order_type, ORDER_TYPES[order_type], priority, description, request.user["name"]),
    )
    conn.commit()
    conn.close()

    return jsonify({"order_no": next_no, "message": "Work order created"}), 201
