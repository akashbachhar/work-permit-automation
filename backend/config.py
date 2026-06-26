import os


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production!")
    DATABASE_NAME = "plant_maintenance.db"
