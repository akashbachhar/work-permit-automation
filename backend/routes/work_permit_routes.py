from flask import Blueprint, request, jsonify
import json
import datetime
import traceback

from backend.db import get_db
from backend.auth import auth_required

work_permit_bp = Blueprint("work_permit", __name__, url_prefix="/api/work-permits")

BASE_PERMIT_NO = 100000100000
BASE_JSA_DOC_NO = 200000000001
BASE_ISO_NO = 300000000001

PERMIT_SUBTYPES = ["Hot", "Cold", "Electrical", "Height", "Composite", "Confined Space"]
SHIFTS = ["07:00 - 15:00", "15:00 - 23:00", "23:00 - 07:00", "08:30 - 17:00", "17:00 - 23:00"]

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
    ei_items = data.get("electrical_isolation_items", [])
    jsa_data = data.get("jsa_data")

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

    cur = conn.execute(
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
            (permit_id, jsa_doc_no, json.dumps(jsa_data)),
        )
    conn.commit()
    conn.close()

    return jsonify({"permit_no": next_no, "iso_no": iso_no, "jsa_doc_no": jsa_doc_no, "message": "Work permit created"}), 201


@work_permit_bp.route("/generate-jsa", methods=["POST"])
@auth_required
def generate_jsa_route():
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
