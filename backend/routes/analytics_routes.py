import json
import datetime
from flask import Blueprint, jsonify, request, send_file
from io import BytesIO
from backend.db import get_db
from backend.routes.auth_routes import auth_required
from backend.routes.admin_routes import admin_required

analytics_bp = Blueprint("analytics", __name__, url_prefix="/api/analytics")
admin_analytics_bp = Blueprint("admin_analytics", __name__, url_prefix="/api/admin/analytics")


def _compute_analytics():
    conn = get_db()
    now = datetime.datetime.now()
    today_str = now.strftime("%Y-%m-%d")

    permits = conn.execute(
        """SELECT permit_subtype, valid_until, renewal_dates, num_workmen,
                  gas_o2, gas_lel, gas_co, gas_h2s, created_at
           FROM work_permits"""
    ).fetchall()
    conn.close()

    permit_by_type = {}
    status_counts = {"active": 0, "pending": 0, "expired": 0}
    today_by_type = {}
    gas_sums = {"o2": 0.0, "lel": 0.0, "co": 0.0, "h2s": 0.0}
    gas_counts = {"o2": 0, "lel": 0, "co": 0, "h2s": 0}
    workmen_by_date = {}

    for p in permits:
        subtype = p["permit_subtype"] or "Unknown"
        permit_by_type[subtype] = permit_by_type.get(subtype, 0) + 1

        renewal_dates = json.loads(p["renewal_dates"] or "[]")
        latest_str = renewal_dates[-1] if renewal_dates else (p["created_at"] or "")
        latest_day = latest_str[:10]

        # Expiry
        try:
            valid_until = datetime.datetime.strptime(p["valid_until"], "%Y-%m-%d %H:%M:%S") if p["valid_until"] else None
            is_expired = valid_until < now if valid_until else False
        except (ValueError, TypeError):
            is_expired = False

        is_active_today = latest_day == today_str

        if is_active_today:
            status_counts["active"] += 1
            today_by_type[subtype] = today_by_type.get(subtype, 0) + 1
        elif is_expired:
            status_counts["expired"] += 1
        else:
            status_counts["pending"] += 1

        # Gas averages
        for key, col in [("o2", "gas_o2"), ("lel", "gas_lel"), ("co", "gas_co"), ("h2s", "gas_h2s")]:
            val = p[col]
            if val is not None:
                gas_sums[key] += float(val)
                gas_counts[key] += 1

        # Workmen by day
        day = (p["created_at"] or "")[:10]
        if day:
            workmen_by_date[day] = workmen_by_date.get(day, 0) + (p["num_workmen"] or 0)

    gas_averages = {
        k: round(gas_sums[k] / gas_counts[k], 2) if gas_counts[k] > 0 else None
        for k in gas_sums
    }

    workmen_series = []
    for i in range(29, -1, -1):
        day = (now - datetime.timedelta(days=i)).strftime("%Y-%m-%d")
        workmen_series.append({"date": day, "workmen": workmen_by_date.get(day, 0)})

    return {
        "permit_by_type": permit_by_type,
        "total_permits": sum(permit_by_type.values()),
        "status_counts": status_counts,
        "today_by_type": today_by_type,
        "gas_averages": gas_averages,
        "workmen_timeseries": workmen_series,
    }


@analytics_bp.route("/summary")
@auth_required
def user_analytics():
    return jsonify(_compute_analytics())


@analytics_bp.route("/export/work-permits")
@auth_required
def user_export_permits():
    from backend.routes.export_routes import _parse_date_range, _build_excel
    d_from, d_to, err = _parse_date_range()
    if err:
        return jsonify({"error": err}), 400
    buf, filename = _build_excel(d_from, d_to)
    return send_file(buf, mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                     as_attachment=True, download_name=filename)


@admin_analytics_bp.route("/summary")
@admin_required
def admin_analytics_summary():
    return jsonify(_compute_analytics())
