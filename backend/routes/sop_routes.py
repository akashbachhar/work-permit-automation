import re
import traceback
from io import BytesIO
from pathlib import Path

from flask import Blueprint, jsonify, request, send_file
from fpdf import FPDF

from backend.db import get_db
from backend.routes.admin_routes import admin_required

sop_bp = Blueprint("sop", __name__, url_prefix="/api/admin")

VALID_LANGUAGES = {"hindi", "bengali", "kannada"}

FONT_DIR = Path(__file__).resolve().parent.parent / "fonts"
LANG_FONTS = {
    "hindi": FONT_DIR / "Lohit-Devanagari.ttf",
    "bengali": FONT_DIR / "Lohit-Bengali.ttf",
    "kannada": FONT_DIR / "Lohit-Kannada.ttf",
}
LANG_SHAPING = {
    "hindi":   {"script": "Deva", "language": "HIN"},
    "bengali": {"script": "Beng", "language": "BEN"},
    "kannada": {"script": "Knda", "language": "KAN"},
}
LATIN_FALLBACK_REGULAR = FONT_DIR / "DejaVuSans.ttf"
LATIN_FALLBACK_BOLD = FONT_DIR / "DejaVuSans-Bold.ttf"

SUBTYPE_HAZARDS = {
    "Hot": "fire, explosion, burns from hot work (welding, cutting, grinding)",
    "Cold": "pressure release, chemical exposure, mechanical injury",
    "Electrical": "electrocution, arc flash, equipment failure",
    "Height": "falls from height, dropped objects, unstable platforms",
    "Confined Space": "asphyxiation, toxic gas buildup, limited egress, oxygen deficiency",
    "Composite": "combined hazards from multiple permit types",
}


def _fetch_permit(permit_id):
    conn = get_db()
    row = conn.execute(
        """SELECT wp.*, wo.description AS work_description, wo.order_type_desc
           FROM work_permits wp
           LEFT JOIN work_orders wo ON wp.work_order_no = wo.order_no
           WHERE wp.id = ?""",
        (permit_id,),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


@sop_bp.route("/work-permits/<int:permit_id>/generate-sop", methods=["POST"])
@admin_required
def generate_sop(permit_id):
    permit = _fetch_permit(permit_id)
    if not permit:
        return jsonify({"error": "Permit not found"}), 404

    gas = (
        f"O2: {permit.get('gas_o2', '-')}%, "
        f"LEL: {permit.get('gas_lel', '-')}%, "
        f"CO: {permit.get('gas_co', '-')}%, "
        f"H2S: {permit.get('gas_h2s', '-')} PPM"
    )

    permit_dict = {
        "permit_no": permit["permit_no"],
        "work_type": permit["permit_subtype"],
        "location": permit["exact_location"],
        "equipment": f"{permit['work_order_no']} — {permit.get('order_type_desc') or ''}".strip(" —"),
        "description": permit.get("work_description") or "",
        "hazards": SUBTYPE_HAZARDS.get(permit["permit_subtype"], "general workplace hazards"),
        "shift": permit["shift"],
        "partner": permit["partner_name"],
        "num_workmen": permit["num_workmen"],
        "gas_readings": gas,
    }

    try:
        from rag.query import generate_sop as rag_generate
        sop_text = rag_generate(permit_dict)
    except Exception as e:
        tb = traceback.format_exc()
        print(f"[SOP ERROR] {type(e).__name__}: {e}\n{tb}", flush=True)
        return jsonify({"error": f"SOP generation failed: {type(e).__name__}: {e}"}), 500

    conn = get_db()
    conn.execute("UPDATE work_permits SET sop_text = ? WHERE id = ?", (sop_text, permit_id))
    conn.commit()
    conn.close()

    return jsonify({"sop": sop_text, "permit_no": permit["permit_no"]})


@sop_bp.route("/work-permits/<int:permit_id>/sop", methods=["GET"])
@admin_required
def get_sop(permit_id):
    conn = get_db()
    row = conn.execute(
        "SELECT permit_no, sop_text FROM work_permits WHERE id = ?", (permit_id,)
    ).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "Permit not found"}), 404
    if not row["sop_text"]:
        return jsonify({"error": "No SOP generated yet"}), 404
    return jsonify({"sop": row["sop_text"], "permit_no": row["permit_no"]})


@sop_bp.route("/work-permits/<int:permit_id>/sop/translations", methods=["GET"])
@admin_required
def get_sop_translations(permit_id):
    conn = get_db()
    rows = conn.execute(
        "SELECT language, sop_text FROM sop_translations WHERE permit_id = ?", (permit_id,)
    ).fetchall()
    conn.close()
    return jsonify({"translations": {r["language"]: r["sop_text"] for r in rows}})


@sop_bp.route("/work-permits/<int:permit_id>/sop/translate", methods=["POST"])
@admin_required
def translate_sop_route(permit_id):
    data = request.get_json(silent=True) or {}
    language = (data.get("language") or "").lower()
    if language not in VALID_LANGUAGES:
        return jsonify({"error": "Invalid language. Choose hindi, bengali, or kannada."}), 400

    conn = get_db()
    row = conn.execute("SELECT sop_text FROM work_permits WHERE id = ?", (permit_id,)).fetchone()
    if not row or not row["sop_text"]:
        conn.close()
        return jsonify({"error": "No SOP available to translate"}), 404

    existing = conn.execute(
        "SELECT sop_text FROM sop_translations WHERE permit_id = ? AND language = ?",
        (permit_id, language),
    ).fetchone()
    if existing:
        conn.close()
        return jsonify({"language": language, "sop": existing["sop_text"]})

    try:
        from rag.query import translate_sop as rag_translate
        translated = rag_translate(row["sop_text"], language)
    except Exception as e:
        tb = traceback.format_exc()
        print(f"[SOP TRANSLATE ERROR] {type(e).__name__}: {e}\n{tb}", flush=True)
        conn.close()
        return jsonify({"error": f"Translation failed: {type(e).__name__}: {e}"}), 500

    conn.execute(
        "INSERT INTO sop_translations (permit_id, language, sop_text) VALUES (?, ?, ?)",
        (permit_id, language, translated),
    )
    conn.commit()
    conn.close()
    return jsonify({"language": language, "sop": translated})


@sop_bp.route("/work-permits/<int:permit_id>/sop/pdf", methods=["GET"])
@admin_required
def get_sop_pdf(permit_id):
    language = (request.args.get("lang") or "english").lower()
    if language != "english" and language not in VALID_LANGUAGES:
        return jsonify({"error": "Invalid language"}), 400

    conn = get_db()
    permit_row = conn.execute(
        "SELECT permit_no, sop_text FROM work_permits WHERE id = ?", (permit_id,)
    ).fetchone()
    if not permit_row:
        conn.close()
        return jsonify({"error": "Permit not found"}), 404

    if language == "english":
        sop_text = permit_row["sop_text"]
    else:
        trow = conn.execute(
            "SELECT sop_text FROM sop_translations WHERE permit_id = ? AND language = ?",
            (permit_id, language),
        ).fetchone()
        sop_text = trow["sop_text"] if trow else None
    conn.close()

    if not sop_text:
        return jsonify({"error": "No SOP available"}), 404

    pdf_bytes = _build_pdf(sop_text, permit_row["permit_no"], language)
    return send_file(
        BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=False,
        download_name=f"SOP-{permit_row['permit_no']}-{language}.pdf",
    )


_UNICODE_MAP = {
    "—": "--", "–": "-", "‒": "-",
    "‘": "'", "’": "'", "“": '"', "”": '"',
    "•": "*", "‣": ">", "●": "*",
    "…": "...", " ": " ", "·": "*",
}


def _normalize_punct(text: str) -> str:
    for ch, rep in _UNICODE_MAP.items():
        text = text.replace(ch, rep)
    return text


def _safe(text: str) -> str:
    text = _normalize_punct(text)
    return text.encode("latin-1", errors="replace").decode("latin-1")


def _strip_inline(text):
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"\*(.+?)\*", r"\1", text)
    return text


def _is_bold_line(text):
    return bool(re.match(r"^\*\*.+\*\*$", text.strip()))


def _build_pdf(sop_text: str, permit_no: str, language: str = "english") -> bytes:
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_margins(20, 15, 20)

    if language == "english":
        font = "Helvetica"
        clean = _safe
    else:
        font = "SOPFont"
        font_path = str(LANG_FONTS[language])
        pdf.add_font(font, "", font_path)
        pdf.add_font(font, "B", font_path)  # no separate bold variant; reuse regular
        pdf.add_font("Latin", "", str(LATIN_FALLBACK_REGULAR))
        pdf.add_font("Latin", "B", str(LATIN_FALLBACK_BOLD))
        pdf.set_fallback_fonts(["Latin"])  # Lohit fonts lack Latin glyphs (headers, numbers)
        shaping = LANG_SHAPING[language]
        pdf.set_text_shaping(True, script=shaping["script"], language=shaping["language"])
        clean = _normalize_punct

    # Header
    pdf.set_font(font, "B", 16)
    pdf.cell(0, 10, "STANDARD OPERATING PROCEDURE", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.set_font(font, "", 11)
    pdf.cell(0, 7, clean(f"Work Permit: {permit_no}"), new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.set_draw_color(100, 100, 100)
    pdf.line(20, pdf.get_y() + 2, 190, pdf.get_y() + 2)
    pdf.ln(8)

    for line in sop_text.split("\n"):
        stripped = line.strip()

        if stripped.startswith("### "):
            text = clean(_strip_inline(stripped[4:]))
            pdf.set_font(font, "B", 11)
            pdf.ln(2)
            pdf.multi_cell(0, 7, text, new_x="LMARGIN", new_y="NEXT")

        elif stripped.startswith("## "):
            text = clean(_strip_inline(stripped[3:]))
            pdf.set_font(font, "B", 13)
            pdf.ln(4)
            pdf.set_fill_color(230, 230, 240)
            pdf.multi_cell(0, 8, text, fill=True, new_x="LMARGIN", new_y="NEXT")

        elif stripped.startswith("# "):
            text = clean(_strip_inline(stripped[2:]))
            pdf.set_font(font, "B", 14)
            pdf.ln(3)
            pdf.multi_cell(0, 9, text, new_x="LMARGIN", new_y="NEXT")

        elif re.match(r"^[*-]\s+", stripped):
            text = clean(_strip_inline(re.sub(r"^[*-]\s+", "", stripped)))
            pdf.set_font(font, "", 10)
            pdf.set_x(26)
            pdf.multi_cell(0, 6, f"*  {text}", new_x="LMARGIN", new_y="NEXT")

        elif re.match(r"^\d+\.\s+", stripped):
            m = re.match(r"^(\d+)\.\s+(.+)$", stripped)
            if m:
                num, text = m.group(1), clean(_strip_inline(m.group(2)))
                pdf.set_font(font, "", 10)
                pdf.set_x(26)
                pdf.multi_cell(0, 6, f"{num}.  {text}", new_x="LMARGIN", new_y="NEXT")

        elif stripped == "":
            pdf.ln(3)

        else:
            text = clean(_strip_inline(stripped))
            if _is_bold_line(stripped):
                pdf.set_font(font, "B", 10)
            else:
                pdf.set_font(font, "", 10)
            pdf.multi_cell(0, 6, text, new_x="LMARGIN", new_y="NEXT")

    return bytes(pdf.output())
