from flask import Flask, render_template, jsonify, request
import sqlite3
import os

app = Flask(__name__, static_folder="static", template_folder="templates")
DATABASE = os.path.join(app.instance_path, "plant_maintenance.db")


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    os.makedirs(app.instance_path, exist_ok=True)
    conn = get_db()
    conn.execute(
        """CREATE TABLE IF NOT EXISTS work_permits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )"""
    )
    conn.commit()
    conn.close()


@app.route("/")
def index():
    return render_template("index.html")


if __name__ == "__main__":
    init_db()
    app.run(debug=True)
