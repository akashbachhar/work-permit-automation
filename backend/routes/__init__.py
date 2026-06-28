from backend.routes.auth_routes import auth_bp
from backend.routes.main_routes import main_bp
from backend.routes.admin_routes import admin_bp
from backend.routes.work_order_routes import work_order_bp

all_blueprints = [auth_bp, main_bp, admin_bp, work_order_bp]
