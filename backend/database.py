"""
SQLAlchemy database configuration for SQLite.
"""

import os
import logging
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Load environment variables
# Check if .env exists in backend or parent directory
env_path = Path(__file__).resolve().parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()

DATABASE_URL: str = os.getenv("DATABASE_URL") or "sqlite:///./pothole_detector.db"

# If using a relative SQLite database URL, resolve it absolutely to the backend folder
# to avoid path issues depending on the current working directory of execution
if DATABASE_URL.startswith("sqlite:///./"):
    db_filename = DATABASE_URL.replace("sqlite:///./", "")
    backend_dir = Path(__file__).resolve().parent
    db_path = backend_dir / db_filename
    DATABASE_URL = f"sqlite:///{db_path.as_posix()}"
    logger_setup = logging.getLogger("pothole_detector.database")
    logger_setup.info(f"Resolved relative SQLite database path to absolute: {DATABASE_URL}")

# Create engine
# For SQLite, we need connect_args={"check_same_thread": False}
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=connect_args)

# Create session maker
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Declarative Base
Base = declarative_base()

# Dependency to get db session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
