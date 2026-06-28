from flask import Blueprint, request, jsonify
import json
import datetime

from backend.db import get_db
from backend.auth import auth_required

work_permit_bp = Blueprint("work_permit", __name__, url_prefix="/api/work-permits")

BASE_PERMIT_NO = 100000100000

PERMIT_SUBTYPES = ["Hot", "Cold", "Electrical", "Height", "Composite", "Confined Space"]
SHIFTS = ["07:00 - 15:00", "15:00 - 23:00", "23:00 - 07:00", "08:30 - 17:00", "17:00 - 23:00"]


@work_permit_bp.route("/options")
@auth_required
def get_options():
    conn = get_db()
    orders = conn.execute("SELECT order_no, description FROM work_orders ORDER BY id DESC").fetchall()
    partners = conn.execute("SELECT partner_no, partner_name FROM partners ORDER BY partner_name").fetchall()
    conn.close()
    return jsonify({
        "work_orders": [dict(o) for o in orders],
        "partners": [dict(p) for p in partners],
        "permit_subtypes": PERMIT_SUBTYPES,
        "shifts": SHIFTS,
    })


@work_permit_bp.route("", methods=["POST"])
@auth_required
def create_permit():
    data = request.get_json()

    work_order_no = (data.get("work_order_no") or "").strip()
    permit_subtype = (data.get("permit_subtype") or "").strip()
    shift = (data.get("shift") or "").strip()
    location_lat = data.get("location_lat")
    location_lng = data.get("location_lng")
    exact_location = (data.get("exact_location") or "").strip()
    num_workmen = data.get("num_workmen")
    partner_no = (data.get("partner_no") or "").strip()
    gas_o2 = data.get("gas_o2")
    gas_lel = data.get("gas_lel")
    gas_co = data.get("gas_co")
    gas_h2s = data.get("gas_h2s")
    checklist_done = data.get("checklist_done", [])
    checklist_not_required = data.get("checklist_not_required", [])

    if not all([work_order_no, permit_subtype, shift, exact_location, partner_no]):
        return jsonify({"error": "All required fields must be filled"}), 400
    if location_lat is None or location_lng is None:
        return jsonify({"error": "Work location coordinate is required"}), 400
    if num_workmen is None or int(num_workmen) < 1:
        return jsonify({"error": "Number of workmen must be at least 1"}), 400
    if permit_subtype not in PERMIT_SUBTYPES:
        return jsonify({"error": "Invalid permit subtype"}), 400
    if shift not in SHIFTS:
        return jsonify({"error": "Invalid shift"}), 400

    conn = get_db()

    order = conn.execute("SELECT order_no FROM work_orders WHERE order_no = ?", (work_order_no,)).fetchone()
    if not order:
        conn.close()
        return jsonify({"error": "Invalid work order number"}), 400

    partner = conn.execute("SELECT partner_no, partner_name FROM partners WHERE partner_no = ?", (partner_no,)).fetchone()
    if not partner:
        conn.close()
        return jsonify({"error": "Invalid partner"}), 400

    last = conn.execute("SELECT permit_no FROM work_permits ORDER BY id DESC LIMIT 1").fetchone()
    next_no = str(int(last["permit_no"]) + 1) if last else str(BASE_PERMIT_NO)

    now = datetime.datetime.now()
    valid_until = (now + datetime.timedelta(days=7)).replace(hour=23, minute=59, second=59)
    renewal_dates = [now.strftime("%Y-%m-%d %H:%M:%S")]

    conn.execute(
        """INSERT INTO work_permits
        (permit_no, work_order_no, permit_subtype, shift, location_lat, location_lng,
         exact_location, num_workmen, partner_no, partner_name,
         gas_o2, gas_lel, gas_co, gas_h2s, checklist_done, checklist_not_required,
         renewal_dates, created_by, valid_until)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (next_no, work_order_no, permit_subtype, shift, location_lat, location_lng,
         exact_location, int(num_workmen), partner_no, partner["partner_name"],
         gas_o2, gas_lel, gas_co, gas_h2s,
         json.dumps(checklist_done), json.dumps(checklist_not_required),
         json.dumps(renewal_dates),
         request.user["name"], valid_until.strftime("%Y-%m-%d %H:%M:%S")),
    )
    conn.commit()
    conn.close()

    return jsonify({"permit_no": next_no, "message": "Work permit created"}), 201


@work_permit_bp.route("/valid")
@auth_required
def list_valid_permits():
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_db()
    permits = conn.execute(
        "SELECT id, permit_no, permit_subtype, exact_location, valid_until FROM work_permits WHERE valid_until >= ? ORDER BY id DESC",
        (now,),
    ).fetchall()
    conn.close()
    return jsonify({"permits": [dict(p) for p in permits]})


@work_permit_bp.route("/markers")
@auth_required
def get_markers():
    conn = get_db()
    permits = conn.execute(
        """SELECT wp.permit_no, wp.work_order_no, wp.permit_subtype, wp.exact_location,
        wp.location_lat, wp.location_lng, wp.shift, wp.num_workmen,
        wp.partner_no, wp.partner_name,
        wp.created_by, wp.created_at, wp.valid_until, wp.renewal_dates,
        wo.description AS work_description
        FROM work_permits wp
        LEFT JOIN work_orders wo ON wp.work_order_no = wo.order_no
        ORDER BY wp.id DESC"""
    ).fetchall()
    conn.close()
    import json as j
    results = []
    for p in permits:
        d = dict(p)
        d["renewal_dates"] = j.loads(d["renewal_dates"] or "[]")
        results.append(d)
    return jsonify({"markers": results})


@work_permit_bp.route("/<int:permit_id>/renew", methods=["POST"])
@auth_required
def renew_permit(permit_id):
    conn = get_db()
    permit = conn.execute("SELECT renewal_dates, valid_until FROM work_permits WHERE id = ?", (permit_id,)).fetchone()
    if not permit:
        conn.close()
        return jsonify({"error": "Permit not found"}), 404

    now = datetime.datetime.now()
    if permit["valid_until"] and datetime.datetime.strptime(permit["valid_until"], "%Y-%m-%d %H:%M:%S") < now:
        conn.close()
        return jsonify({"error": "Cannot renew approval for an expired permit"}), 400

    dates = json.loads(permit["renewal_dates"] or "[]")
    dates.append(now.strftime("%Y-%m-%d %H:%M:%S"))

    conn.execute(
        "UPDATE work_permits SET renewal_dates = ? WHERE id = ?",
        (json.dumps(dates), permit_id),
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Approval renewed", "renewed_at": now.strftime("%Y-%m-%d %H:%M:%S")})
