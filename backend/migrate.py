import os
import sqlite3
from pathlib import Path

# Set up backend import context
import sys
backend_dir = Path(__file__).resolve().parent
if str(backend_dir.parent) not in sys.path:
    sys.path.append(str(backend_dir.parent))

from backend.database import DATABASE_URL

def run_migration():
    # Parse DATABASE_URL to get the database path
    # e.g., sqlite:///C:/Users/Nandan SV/Desktop/pothole finder/backend/pothole_detector.db
    # or sqlite:////absolute/path
    db_path_str = DATABASE_URL.replace("sqlite:///", "")
    
    # On Windows, sometimes the path starts with a slash like /C:/Users...
    # Strip leading slash if it precedes a drive letter
    if os.name == 'nt' and db_path_str.startswith("/") and len(db_path_str) > 2 and db_path_str[2] == ':':
        db_path_str = db_path_str[1:]
        
    db_path = Path(db_path_str)
    
    print(f"Connecting to database at: {db_path}")
    if not db_path.exists():
        print(f"Database file does not exist at {db_path}. It will be created when the FastAPI app starts.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check current columns in detections
    cursor.execute("PRAGMA table_info(detections)")
    columns = [row[1] for row in cursor.fetchall()]
    
    if "is_baseline" not in columns:
        print("Adding is_baseline column...")
        cursor.execute("ALTER TABLE detections ADD COLUMN is_baseline BOOLEAN DEFAULT 0")
        
    if "compared_to_detection_id" not in columns:
        print("Adding compared_to_detection_id column...")
        cursor.execute("ALTER TABLE detections ADD COLUMN compared_to_detection_id INTEGER REFERENCES detections(id)")
        
    conn.commit()
    conn.close()
    print("Migration completed successfully.")

if __name__ == "__main__":
    run_migration()
