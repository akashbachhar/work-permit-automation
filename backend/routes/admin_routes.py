from functools import wraps
from flask import Blueprint, request, jsonify, current_app
import bcrypt
import json as _json
import jwt
import datetime
import traceback

from backend.db import get_db

BASE_JSA_DOC_NO = 200000000001
BASE_ISO_NO = 300000000001

JSA_JOB_STEPS = [
    'ALIGNMENT WORK','ANTI TERMITE TREATMENT','ASPHALT CONCRETE PAVING','BATTERY MAINTENANCE',
    'BUILDING PAINTING','BUILDING REPAIR','CABLE LOOP CHECKING','CABLE/OFC JOINTING',
    'COLD CUTTING','COLD FLARING','CONCRETE BREAKING','D. G. / FIRE ENGINE MAINTENANCE',
    'DCV REPAIR','DISMANTLING OF STRUCTURE','DRILLING','EARTH PIT TESTING',
    'EMERGENCY RESPONSE VEHICLE','ENTRY IN CONFINED SPACE (AG TANKS FRT)',
    'ENTRY IN CONFINED SPACE (CLOSED VESSELS)','ERECTION & USE OF SCAFFOLDING',
    'ERECTION OF MS STRUCTURE','EXCAVATION','FENCING OF BOUNDARY WALL',
    'FIRE EXTINGUISHER SERVICING (CO2)','FIRE EXTINGUISHER SERVICING (DCP)',
    'FLANGE JOINT CONNECTION/DISCONNECTION','GAS CUTTING','GASKET REPLACEMENT',
    'GENERAL MAINTENANCE OF PUMPS','GRASS CUTTING / GARDENING','GRASS CUTTING BY MACHINE',
    'GRIT/SAND/CU BLASTING','HIGH MAST LIGHT REPLACEMENT','HOUSEKEEPING OF PLANT AREA',
    'HT/LT SWITCHGEAR MAINTENANCE','HVLR REPAIR','HYDRO TESTING',
    'HYDROSTATIC TESTING OF HOSE','INSTALLATION OF MATERIAL BY CRANE',
    'LIFTING OF MATERIAL BY CHAIN PULLEY','LIGHTING /FANS/AC MAINTENANCE',
    'MAINTENANCE OF CLEAN AGENT SYSTEM','MAINTENANCE OF EOT/HOT/JIB CRANE',
    'MAINTENANCE OF FIRE ALARM PANEL','MAINTENANCE OF HVAC/AC REPAIR',
    'MAINTENANCE OF HYDRANT / MONITOR','MAINTENANCE OF MFM','SEAL LEAKAGE SWITCH',
    'LEVEL SWITCH','MAINTENANCE OF TELECOM SYSTEMS',
    'MAINTENANCE/ CALIBRATION OF PT, PG, DPT, PS','MAINTENANCE/REPAIR OF ELECTRIC MOTOR',
    'MAINTENNACE OF FCV/PCV','MISC ELECTRICAL MAINTENANCE','MISC. CIVIL / BRICK WORK',
    'MISC. CIVIL STRUCTURE DISMANTLING','MISC. ELECTRICAL WORK ELECTRICAL ISOLATION',
    'MOCK FIRE DRILL','MOV ACTUATOR REPAIR/CONFIGURATION','MOV REPAIR','OFFICE WORK SITTING',
    'OIL TOP UP FOR PUMPS','OPERATION OF DV','PEST CONTROL','PHOTOGRAPHY',
    'PIGGING OPERATION INCLUDING BARREL SERVICING','PIPELINE REPAIRS / REPLACEMENT',
    'PIPELINE SLEEVING JOB','PIPELINE/EQUIPMENT ERECTION',
    'POST WELD TREATMENT/STRESS RELIEVING/NORMALISING','PRODUCT REMOVAL & DEPRESSURIZING',
    'PSP MEASUREMENT','PUMP ALIGNMENT','PUMP REPAIR','RADIOGRAPHY WORK',
    'REPAIR OF FIRE EXTINGUISHER','REPLACEMENT OF FUSE IN ELECTRICAL POWERED PANEL',
    'RESUME OPERATION','ROOF SHEET REPAIR','SHIFTING OF HEAVY MATERIAL','SPRAY PAINTING',
    'SPRINKLER CLEANING','STRAINER CLEANING','SWITCH YARD MAINTENANCE','SWIVEL JOINT REPAIR',
    'TANK LEG POSITION CHANGE','TRANSFORMER MAINTENANCE','TSV / SRV MAINTENANCE',
    'USE OF HAND TOOLS','USING LAPTOP/CALIBRATION REMOTE IN HAZARDOUS LOCATION',
    'VALVE REPAIR','VALVE REPLACEMENT','VEHICLE ENTRY','WELDING','WORK AT HEIGHT',
    'WORK START UP','WRAPPING COATING PIPELINES',
]

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
    users = conn.execute("SELECT id, name, designation, email, password_hash, created_at FROM users ORDER BY id").fetchall()
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


@admin_bp.route("/users/<int:user_id>", methods=["PUT"])
@admin_required
def update_user(user_id):
    data = request.get_json()
    name = (data.get("name") or "").strip()
    designation = (data.get("designation") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = (data.get("password") or "").strip()

    if not name or not designation or not email:
        return jsonify({"error": "Name, designation, and email are required"}), 400

    conn = get_db()
    if password:
        if len(password) < 8:
            conn.close()
            return jsonify({"error": "Password must be at least 8 characters"}), 400
        pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        conn.execute("UPDATE users SET name = ?, designation = ?, email = ?, password_hash = ? WHERE id = ?",
                     (name, designation, email, pw_hash, user_id))
    else:
        conn.execute("UPDATE users SET name = ?, designation = ?, email = ? WHERE id = ?",
                     (name, designation, email, user_id))
    conn.commit()
    conn.close()
    return jsonify({"message": "User updated"})


@admin_bp.route("/permit-options")
@admin_required
def get_permit_options():
    from backend.routes.work_permit_routes import PERMIT_SUBTYPES, SHIFTS
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


@admin_bp.route("/create-permit", methods=["POST"])
@admin_required
def admin_create_permit():
    import json, datetime
    from backend.routes.work_permit_routes import PERMIT_SUBTYPES, SHIFTS, BASE_PERMIT_NO

    data = request.get_json()
    work_order_no = (data.get("work_order_no") or "").strip()
    permit_subtype = (data.get("permit_subtype") or "").strip()
    shift = (data.get("shift") or "").strip()
    location_lat = data.get("location_lat")
    location_lng = data.get("location_lng")
    exact_location = (data.get("exact_location") or "").strip()
    num_workmen = data.get("num_workmen")
    partner_no = (data.get("partner_no") or "").strip()
    ei_items = data.get("electrical_isolation_items", [])
    jsa_data = data.get("jsa_data")

    if not all([work_order_no, permit_subtype, shift, exact_location, partner_no]):
        return jsonify({"error": "All required fields must be filled"}), 400
    if location_lat is None or location_lng is None:
        return jsonify({"error": "Work location coordinate is required"}), 400
    if num_workmen is None or int(num_workmen) < 1:
        return jsonify({"error": "Number of workmen must be at least 1"}), 400

    conn = get_db()
    partner = conn.execute("SELECT partner_name FROM partners WHERE partner_no = ?", (partner_no,)).fetchone()
    if not partner:
        conn.close()
        return jsonify({"error": "Invalid partner"}), 400

    last = conn.execute("SELECT permit_no FROM work_permits ORDER BY id DESC LIMIT 1").fetchone()
    next_no = str(int(last["permit_no"]) + 1) if last else str(BASE_PERMIT_NO)

    now = datetime.datetime.now()
    valid_until = (now + datetime.timedelta(days=7)).replace(hour=23, minute=59, second=59)
    renewal_dates = [now.strftime("%Y-%m-%d %H:%M:%S")]

    cur = conn.execute(
        """INSERT INTO work_permits
        (permit_no, work_order_no, permit_subtype, shift, location_lat, location_lng,
         exact_location, num_workmen, partner_no, partner_name,
         gas_o2, gas_lel, gas_co, gas_h2s, checklist_done, checklist_not_required,
         renewal_dates, created_by, valid_until)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (next_no, work_order_no, permit_subtype, shift, location_lat, location_lng,
         exact_location, int(num_workmen), partner_no, partner["partner_name"],
         data.get("gas_o2"), data.get("gas_lel"), data.get("gas_co"), data.get("gas_h2s"),
         json.dumps(data.get("checklist_done", [])),
         json.dumps(data.get("checklist_not_required", [])),
         json.dumps(renewal_dates),
         f"admin:{request.admin['username']}", valid_until.strftime("%Y-%m-%d %H:%M:%S")),
    )
    permit_id = cur.lastrowid

    iso_no = None
    valid_ei = [i for i in ei_items if (i.get("technical_object") or "").strip()]
    if valid_ei:
        last_iso = conn.execute("SELECT iso_no FROM electrical_isolations WHERE iso_no IS NOT NULL ORDER BY id DESC LIMIT 1").fetchone()
        iso_no = str(int(last_iso["iso_no"]) + 1) if last_iso else str(BASE_ISO_NO)
        for item in valid_ei:
            conn.execute(
                "INSERT INTO electrical_isolations (permit_id, technical_object, quantity, iso_no) VALUES (?, ?, ?, ?)",
                (permit_id, item["technical_object"].strip(), int(item.get("quantity") or 1), iso_no),
            )

    jsa_doc_no = None
    if jsa_data:
        last_jsa = conn.execute("SELECT doc_no FROM jsa_records ORDER BY id DESC LIMIT 1").fetchone()
        jsa_doc_no = str(int(last_jsa["doc_no"]) + 1) if last_jsa else str(BASE_JSA_DOC_NO)
        conn.execute(
            "INSERT INTO jsa_records (permit_id, doc_no, jsa_content) VALUES (?, ?, ?)",
            (permit_id, jsa_doc_no, _json.dumps(jsa_data)),
        )
    conn.commit()
    conn.close()
    return jsonify({"permit_no": next_no, "iso_no": iso_no, "jsa_doc_no": jsa_doc_no, "message": "Work permit created"}), 201


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


@admin_bp.route("/partners")
@admin_required
def list_partners():
    conn = get_db()
    partners = conn.execute("SELECT id, partner_no, partner_name, created_at FROM partners ORDER BY id DESC").fetchall()
    conn.close()
    return jsonify({"partners": [dict(p) for p in partners]})


@admin_bp.route("/partners", methods=["POST"])
@admin_required
def create_partner():
    data = request.get_json()
    partner_no = (data.get("partner_no") or "").strip()
    partner_name = (data.get("partner_name") or "").strip()

    if not partner_no or not partner_name:
        return jsonify({"error": "Partner number and name are required"}), 400

    conn = get_db()
    try:
        conn.execute("INSERT INTO partners (partner_no, partner_name) VALUES (?, ?)", (partner_no, partner_name))
        conn.commit()
    except Exception:
        conn.close()
        return jsonify({"error": "Partner number already exists"}), 409
    conn.close()
    return jsonify({"message": "Partner created"}), 201


@admin_bp.route("/partners/<int:partner_id>", methods=["PUT"])
@admin_required
def update_partner(partner_id):
    data = request.get_json()
    partner_no = (data.get("partner_no") or "").strip()
    partner_name = (data.get("partner_name") or "").strip()

    if not partner_no or not partner_name:
        return jsonify({"error": "Partner number and name are required"}), 400

    conn = get_db()
    conn.execute("UPDATE partners SET partner_no = ?, partner_name = ? WHERE id = ?", (partner_no, partner_name, partner_id))
    conn.commit()
    conn.close()
    return jsonify({"message": "Partner updated"})


@admin_bp.route("/partners/<int:partner_id>", methods=["DELETE"])
@admin_required
def delete_partner(partner_id):
    conn = get_db()
    conn.execute("DELETE FROM partners WHERE id = ?", (partner_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Partner deleted"})


@admin_bp.route("/work-permits")
@admin_required
def list_work_permits():
    conn = get_db()
    permits = conn.execute(
        """SELECT wp.id, wp.permit_no, wp.work_order_no, wp.permit_subtype, wp.shift,
        wp.location_lat, wp.location_lng, wp.exact_location, wp.num_workmen,
        wp.partner_no, wp.partner_name, wp.gas_o2, wp.gas_lel, wp.gas_co, wp.gas_h2s,
        wp.checklist_done, wp.checklist_not_required, wp.renewal_dates,
        wp.created_by, wp.created_at, wp.valid_until, wp.sop_text,
        wo.description AS work_description
        FROM work_permits wp
        LEFT JOIN work_orders wo ON wp.work_order_no = wo.order_no
        ORDER BY wp.id DESC"""
    ).fetchall()
    conn.close()
    import json
    results = []
    for p in permits:
        d = dict(p)
        d["checklist_done"] = json.loads(d["checklist_done"] or "[]")
        d["checklist_not_required"] = json.loads(d["checklist_not_required"] or "[]")
        d["renewal_dates"] = json.loads(d["renewal_dates"] or "[]")
        results.append(d)
    return jsonify({"work_permits": results})


@admin_bp.route("/work-permits/<int:permit_id>", methods=["DELETE"])
@admin_required
def delete_work_permit(permit_id):
    conn = get_db()
    conn.execute("DELETE FROM sop_translations WHERE permit_id = ?", (permit_id,))
    conn.execute("DELETE FROM electrical_isolations WHERE permit_id = ?", (permit_id,))
    conn.execute("DELETE FROM jsa_records WHERE permit_id = ?", (permit_id,))
    conn.execute("DELETE FROM work_permits WHERE id = ?", (permit_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Work permit deleted"})


@admin_bp.route("/work-permits/<int:permit_id>", methods=["PUT"])
@admin_required
def update_work_permit(permit_id):
    import json
    data = request.get_json()

    conn = get_db()
    conn.execute(
        """UPDATE work_permits SET
        permit_subtype = ?, shift = ?, location_lat = ?, location_lng = ?,
        exact_location = ?, num_workmen = ?, partner_no = ?, partner_name = ?,
        gas_o2 = ?, gas_lel = ?, gas_co = ?, gas_h2s = ?,
        checklist_done = ?, checklist_not_required = ?
        WHERE id = ?""",
        (
            data["permit_subtype"], data["shift"],
            data["location_lat"], data["location_lng"],
            data["exact_location"], data["num_workmen"],
            data["partner_no"], data["partner_name"],
            data.get("gas_o2"), data.get("gas_lel"),
            data.get("gas_co"), data.get("gas_h2s"),
            json.dumps(data.get("checklist_done", [])),
            json.dumps(data.get("checklist_not_required", [])),
            permit_id,
        ),
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Work permit updated"})


@admin_bp.route("/generate-jsa", methods=["POST"])
@admin_required
def admin_generate_jsa():
    data = request.get_json(silent=True) or {}
    work_order_no = (data.get("work_order_no") or "").strip()
    permit_subtype = (data.get("permit_subtype") or "").strip()

    if not permit_subtype:
        return jsonify({"error": "Permit subtype is required"}), 400

    conn = get_db()
    order = conn.execute("SELECT description FROM work_orders WHERE order_no = ?", (work_order_no,)).fetchone()
    conn.close()
    work_description = order["description"] if order else ""

    try:
        from rag.query import generate_jsa as rag_generate_jsa
        jsa = rag_generate_jsa(permit_subtype, work_description, JSA_JOB_STEPS)
    except Exception as e:
        print(f"[JSA ERROR] {type(e).__name__}: {e}\n{traceback.format_exc()}", flush=True)
        return jsonify({"error": f"JSA generation failed: {type(e).__name__}: {e}"}), 500

    return jsonify({"jsa": jsa})


@admin_bp.route("/electrical-isolations")
@admin_required
def list_electrical_isolations():
    conn = get_db()
    rows = conn.execute(
        """SELECT ei.permit_id, ei.technical_object, ei.quantity, ei.tagging_condition, ei.iso_no,
               wp.permit_no, wp.exact_location, wp.work_order_no,
               wo.description AS work_description
           FROM electrical_isolations ei
           JOIN work_permits wp ON ei.permit_id = wp.id
           LEFT JOIN work_orders wo ON wp.work_order_no = wo.order_no
           ORDER BY ei.permit_id, ei.id"""
    ).fetchall()
    conn.close()

    grouped = {}
    for r in rows:
        pid = r["permit_id"]
        if pid not in grouped:
            grouped[pid] = {
                "permit_id": pid,
                "permit_no": r["permit_no"],
                "exact_location": r["exact_location"],
                "work_description": r["work_description"] or "",
                "tagging_condition": r["tagging_condition"],
                "iso_no": r["iso_no"],
                "items": [],
            }
        grouped[pid]["items"].append({
            "technical_object": r["technical_object"],
            "quantity": r["quantity"],
        })
    return jsonify({"electrical_isolations": list(grouped.values())})


@admin_bp.route("/work-permits/<int:permit_id>/jsa")
@admin_required
def get_permit_jsa(permit_id):
    conn = get_db()
    row = conn.execute(
        "SELECT doc_no, jsa_content FROM jsa_records WHERE permit_id = ? LIMIT 1", (permit_id,)
    ).fetchone()
    conn.close()
    if not row:
        return jsonify({"jsa": None})
    d = dict(row)
    d["jsa_content"] = _json.loads(d["jsa_content"]) if d["jsa_content"] else None
    return jsonify({"jsa": d})


@admin_bp.route("/work-permits/<int:permit_id>/electrical-isolations")
@admin_required
def get_permit_electrical_isolations(permit_id):
    conn = get_db()
    rows = conn.execute(
        "SELECT iso_no, technical_object, quantity, tagging_condition FROM electrical_isolations WHERE permit_id = ? ORDER BY id",
        (permit_id,)
    ).fetchall()
    conn.close()
    if not rows:
        return jsonify({"electrical_isolations": None})
    items = [dict(r) for r in rows]
    return jsonify({
        "electrical_isolations": {
            "iso_no": items[0]["iso_no"],
            "tagging_condition": items[0]["tagging_condition"],
            "items": [{"technical_object": i["technical_object"], "quantity": i["quantity"]} for i in items],
        }
    })


@admin_bp.route("/electrical-isolations/<int:permit_id>/energise", methods=["POST"])
@admin_required
def energise_isolation(permit_id):
    conn = get_db()
    existing = conn.execute(
        "SELECT tagging_condition FROM electrical_isolations WHERE permit_id = ? LIMIT 1", (permit_id,)
    ).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "No electrical isolation found for this permit"}), 404
    if existing["tagging_condition"] == "energised":
        conn.close()
        return jsonify({"error": "Already energised — this action can only be performed once"}), 409
    conn.execute(
        "UPDATE electrical_isolations SET tagging_condition = 'energised' WHERE permit_id = ?", (permit_id,)
    )
    conn.commit()
    conn.close()
    return jsonify({"tagging_condition": "energised"})


@admin_bp.route("/jsa-records")
@admin_required
def list_jsa_records():
    import json as _j
    conn = get_db()
    rows = conn.execute(
        """SELECT jr.id, jr.permit_id, jr.doc_no, jr.jsa_content, jr.created_at, wp.permit_no
           FROM jsa_records jr
           JOIN work_permits wp ON jr.permit_id = wp.id
           ORDER BY jr.id DESC"""
    ).fetchall()
    conn.close()
    results = []
    for r in rows:
        d = dict(r)
        d["jsa_content"] = _j.loads(d["jsa_content"]) if d["jsa_content"] else None
        results.append(d)
    return jsonify({"jsa_records": results})


@admin_bp.route("/work-permits/<int:permit_id>/renew", methods=["POST"])
@admin_required
def renew_work_permit(permit_id):
    import json, datetime
    conn = get_db()
    permit = conn.execute("SELECT renewal_dates, valid_until FROM work_permits WHERE id = ?", (permit_id,)).fetchone()
    if not permit:
        conn.close()
        return jsonify({"error": "Permit not found"}), 404

    dates = json.loads(permit["renewal_dates"] or "[]")
    now = datetime.datetime.now()
    dates.append(now.strftime("%Y-%m-%d %H:%M:%S"))

    conn.execute(
        "UPDATE work_permits SET renewal_dates = ? WHERE id = ?",
        (json.dumps(dates), permit_id),
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Approval renewed", "renewed_at": now.strftime("%Y-%m-%d %H:%M:%S")})
