import sqlite3
import os
from flask import current_app


def get_db():
    db_path = os.path.join(current_app.instance_path, current_app.config["DATABASE_NAME"])
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    os.makedirs(current_app.instance_path, exist_ok=True)
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            designation TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS work_permits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            permit_no TEXT UNIQUE NOT NULL,
            work_order_no TEXT NOT NULL,
            permit_subtype TEXT NOT NULL,
            shift TEXT NOT NULL,
            location_lat REAL NOT NULL,
            location_lng REAL NOT NULL,
            exact_location TEXT NOT NULL,
            num_workmen INTEGER NOT NULL,
            partner_no TEXT NOT NULL,
            partner_name TEXT NOT NULL,
            gas_o2 REAL,
            gas_lel REAL,
            gas_co REAL,
            gas_h2s REAL,
            checklist_done TEXT,
            checklist_not_required TEXT,
            renewal_dates TEXT,
            created_by TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            valid_until TIMESTAMP,
            sop_text TEXT
        );
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS partners (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            partner_no TEXT UNIQUE NOT NULL,
            partner_name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS work_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_no TEXT UNIQUE NOT NULL,
            order_type TEXT NOT NULL,
            order_type_desc TEXT NOT NULL,
            priority TEXT NOT NULL,
            description TEXT NOT NULL,
            created_by TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS sop_translations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            permit_id INTEGER NOT NULL,
            language TEXT NOT NULL,
            sop_text TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(permit_id, language)
        );
    """)
    conn.commit()

    # Migration: add sop_text if upgrading from older schema
    try:
        conn.execute("ALTER TABLE work_permits ADD COLUMN sop_text TEXT")
        conn.commit()
    except Exception:
        pass  # column already exists

    import bcrypt
    existing = conn.execute("SELECT id FROM admins WHERE username = 'admin'").fetchone()
    if not existing:
        pw_hash = bcrypt.hashpw("admin@123".encode(), bcrypt.gensalt()).decode()
        conn.execute("INSERT INTO admins (username, password_hash) VALUES (?, ?)", ("admin", pw_hash))
        conn.commit()

    default_partners = [
        ("50007134", "K.J.ELECTRICALS"),
        ("50051492", "AMBETRONICS ENGG.PVT.LTD"),
        ("50006659", "S.P.ENGINEERING WORKS"),
        ("50021792", "J S ENTERPRISES"),
        ("50035312", "SVS SERVICES"),
        ("50043660", "MAPTEC SURVEY CONSULTANCY PVT. LTD."),
    ]
    for pno, pname in default_partners:
        existing = conn.execute("SELECT id FROM partners WHERE partner_no = ?", (pno,)).fetchone()
        if not existing:
            conn.execute("INSERT INTO partners (partner_no, partner_name) VALUES (?, ?)", (pno, pname))
    conn.commit()

    conn.close()
