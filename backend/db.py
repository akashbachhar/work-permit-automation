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
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS work_permits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        );
    """)
    conn.commit()

    import bcrypt
    existing = conn.execute("SELECT id FROM admins WHERE username = 'admin'").fetchone()
    if not existing:
        pw_hash = bcrypt.hashpw("admin@123".encode(), bcrypt.gensalt()).decode()
        conn.execute("INSERT INTO admins (username, password_hash) VALUES (?, ?)", ("admin", pw_hash))
        conn.commit()

    conn.close()
