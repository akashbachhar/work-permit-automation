from backend.routes.auth_routes import auth_bp
from backend.routes.main_routes import main_bp
from backend.routes.admin_routes import admin_bp
from backend.routes.work_order_routes import work_order_bp
from backend.routes.work_permit_routes import work_permit_bp
from backend.routes.sop_routes import sop_bp
from backend.routes.analytics_routes import analytics_bp, admin_analytics_bp
from backend.routes.export_routes import export_bp

all_blueprints = [auth_bp, main_bp, admin_bp, work_order_bp, work_permit_bp, sop_bp, analytics_bp, admin_analytics_bp, export_bp]
