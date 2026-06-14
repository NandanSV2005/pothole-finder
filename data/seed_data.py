"""
Pothole and Road Damage Detection System - Seed Data Script
This script populates the SQLite database with default user accounts and 20 realistic
detections spread across Bengaluru. It also generates simulated annotated images for each case.
"""

import os
import sys
import random
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
import cv2
import numpy as np

# Adjust python path to allow importing from backend
sys.path.append(str(Path(__file__).resolve().parent.parent))

from backend.database import SessionLocal, engine, Base
from backend.models.models import User, Detection
from backend.auth import hash_password

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("pothole_detector.seeder")

# Damage classifications and OpenCV colors
CLASSES = ["pothole", "crack", "waterlogging", "road_collapse"]
COLORS = {
    "pothole": (0, 0, 255),         # Red
    "crack": (0, 165, 255),         # Orange
    "waterlogging": (0, 255, 255),    # Yellow
    "road_collapse": (128, 0, 128)   # Purple
}

# Bengaluru coordinates and names mapping for realistic geocoded database
BENGALURU_LOCATIONS = [
    {"lat": 12.9716, "lng": 77.5946, "address": "Kasturba Road, Majestic, Bengaluru, Karnataka, 560001, India"},
    {"lat": 12.9784, "lng": 77.6408, "address": "100 Feet Rd, Indiranagar, Bengaluru, Karnataka, 560038, India"},
    {"lat": 12.9352, "lng": 77.6245, "address": "80 Feet Rd, Koramangala 4th Block, Bengaluru, Karnataka, 560034, India"},
    {"lat": 12.9116, "lng": 77.6389, "address": "27th Main Rd, Sector 1, HSR Layout, Bengaluru, Karnataka, 560102, India"},
    {"lat": 12.9698, "lng": 77.7499, "address": "ITPL Main Rd, Whitefield, Bengaluru, Karnataka, 560066, India"},
    {"lat": 13.0031, "lng": 77.5643, "address": "Margosa Rd, Malleshwaram, Bengaluru, Karnataka, 560003, India"},
    {"lat": 13.0359, "lng": 77.5978, "address": "Outer Ring Rd, Hebbal, Bengaluru, Karnataka, 560024, India"},
    {"lat": 12.9592, "lng": 77.6974, "address": "HAL Old Airport Rd, Marathahalli, Bengaluru, Karnataka, 560037, India"},
    {"lat": 12.9250, "lng": 77.5896, "address": "9th Main Rd, Jayanagar 4th Block, Bengaluru, Karnataka, 560011, India"},
    {"lat": 12.9166, "lng": 77.6101, "address": "Outer Ring Rd, BTM Layout 2nd Stage, Bengaluru, Karnataka, 560076, India"},
    {"lat": 12.9796, "lng": 77.5701, "address": "Dr Rajkumar Rd, Rajajinagar, Bengaluru, Karnataka, 560010, India"},
    {"lat": 13.0805, "lng": 77.5882, "address": "Doddaballapur Rd, Yelahanka, Bengaluru, Karnataka, 560064, India"},
    {"lat": 12.8452, "lng": 77.6620, "address": "Hosur Rd, Phase 1, Electronic City, Bengaluru, Karnataka, 560100, India"},
    {"lat": 12.9304, "lng": 77.6784, "address": "Outer Ring Rd, Bellandur, Bengaluru, Karnataka, 560103, India"},
    {"lat": 12.9068, "lng": 77.5730, "address": "Outer Ring Rd, Banashankari 3rd Stage, Bengaluru, Karnataka, 560085, India"},
    {"lat": 12.9734, "lng": 77.6185, "address": "Halasuru Road, Ulsoor, Bengaluru, Karnataka, 560008, India"},
    {"lat": 12.9407, "lng": 77.5737, "address": "Gandhi Bazaar Main Rd, Basavanagudi, Bengaluru, Karnataka, 560004, India"},
    {"lat": 12.9642, "lng": 77.6378, "address": "12th Main Rd, Domlur, Bengaluru, Karnataka, 560071, India"},
    {"lat": 13.0242, "lng": 77.6432, "address": "80 Feet Rd, Kalyan Nagar, Bengaluru, Karnataka, 560043, India"},
    {"lat": 12.9692, "lng": 77.5982, "address": "Richmond Rd, Richmond Town, Bengaluru, Karnataka, 560025, India"}
]

def generate_mock_image(damage_class: str, output_path: Path):
    """
    Creates a simulated annotated road image with boxes using OpenCV.
    """
    # 640x480 gray canvas simulating asphalt
    img = np.zeros((480, 640, 3), dtype=np.uint8)
    img[:] = (55, 58, 60) # dark gray asphalt color
    
    # Draw simple yellow dashed road dividing line
    cv2.line(img, (320, 0), (320, 100), (0, 215, 255), 8)
    cv2.line(img, (320, 150), (320, 250), (0, 215, 255), 8)
    cv2.line(img, (320, 300), (320, 400), (0, 215, 255), 8)
    cv2.line(img, (320, 450), (320, 480), (0, 215, 255), 8)
    
    # Draw side lanes (white solid lines)
    cv2.line(img, (50, 0), (50, 480), (240, 240, 240), 4)
    cv2.line(img, (590, 0), (590, 480), (240, 240, 240), 4)
    
    # Draw class-specific road damage shape
    if damage_class == "pothole":
        # Draw dark gray crater
        cv2.circle(img, (380, 320), 40, (30, 30, 30), -1)
        cv2.circle(img, (380, 320), 38, (45, 45, 45), -1)
        # Inner cracks
        cv2.line(img, (350, 320), (330, 330), (20, 20, 20), 2)
        cv2.line(img, (410, 320), (430, 310), (20, 20, 20), 2)
        bbox = [320, 260, 440, 380]
        
    elif damage_class == "crack":
        # Draw a lightning-like crack
        points = np.array([[200, 200], [210, 230], [195, 260], [220, 300], [205, 330], [215, 360]], dtype=np.int32)
        cv2.polylines(img, [points], False, (20, 20, 20), 4)
        bbox = [170, 180, 240, 380]
        
    elif damage_class == "waterlogging":
        # Blue blob representing water puddles
        points = np.array([[120, 350], [180, 330], [260, 360], [240, 410], [160, 420], [100, 390]], dtype=np.int32)
        cv2.fillPoly(img, [points], (180, 130, 70)) # Blue/Teal water color (BGR: B=180, G=130, R=70)
        # Add reflection details
        cv2.ellipse(img, (180, 370), (40, 10), 0, 0, 360, (210, 160, 90), -1)
        bbox = [90, 310, 280, 430]
        
    elif damage_class == "road_collapse":
        # Block of missing asphalt with hazard stripes
        pts = np.array([[380, 150], [530, 130], [550, 250], [400, 260]], dtype=np.int32)
        cv2.fillPoly(img, [pts], (20, 20, 20))
        # Draw warning boundary line
        cv2.polylines(img, [pts], True, (0, 165, 255), 4)
        bbox = [360, 110, 570, 280]
        
    else:
        bbox = [100, 100, 200, 200]

    # Draw YOLOv8 style bounding box
    color = COLORS.get(damage_class, (0, 255, 0))
    xmin, ymin, xmax, ymax = bbox
    cv2.rectangle(img, (xmin, ymin), (xmax, ymax), color, 3)
    
    # Label drawing
    conf = random.uniform(0.65, 0.94)
    label = f"{damage_class.replace('_', ' ').title()} {conf:.2f}"
    
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.6
    thickness = 2
    (tw, th), baseline = cv2.getTextSize(label, font, font_scale, thickness)
    
    cv2.rectangle(img, (xmin, ymin - th - 10), (xmin + tw + 10, ymin + baseline - 5), color, cv2.FILLED)
    cv2.putText(img, label, (xmin + 5, ymin - 5), font, font_scale, (255, 255, 255), thickness, lineType=cv2.LINE_AA)
    
    # Save physical file
    cv2.imwrite(str(output_path), img)

def seed():
    logger.info("Starting database seeding...")
    
    # 1. Create upload folder
    upload_dir = Path("backend/data/uploads")
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    db = SessionLocal()
    try:
        # Create all tables first
        Base.metadata.create_all(bind=engine)
        
        # 2. Check and Seed Users
        if db.query(User).count() == 0:
            logger.info("Seeding default accounts...")
            admin = User(
                username="admin",
                hashed_password=hash_password("adminpassword"),
                role="admin"
            )
            citizen = User(
                username="citizen",
                hashed_password=hash_password("citizenpassword"),
                role="citizen"
            )
            db.add(admin)
            db.add(citizen)
            db.commit()
            logger.info("Accounts created: admin / adminpassword, citizen / citizenpassword.")
        else:
            logger.info("Users already seeded. Skipping accounts.")

        # 3. Seed Detections
        if db.query(Detection).count() == 0:
            logger.info("Seeding 20 road damage detections...")
            
            for i, loc in enumerate(BENGALURU_LOCATIONS):
                damage_class = CLASSES[i % len(CLASSES)]
                conf = round(random.uniform(0.55, 0.93), 2)
                is_verified = (i % 3 == 0) # 33% verified entries
                
                # Timestamp distributed over the last 3 days
                hours_ago = random.randint(1, 72)
                timestamp = datetime.now(timezone.utc) - timedelta(hours=hours_ago)
                
                # Image file name and generation
                filename = f"seeded_{damage_class}_{i+1}.jpg"
                output_path = upload_dir / filename
                generate_mock_image(damage_class, output_path)
                
                if damage_class == "road_collapse":
                    severity = "critical"
                elif damage_class == "crack":
                    severity = "minor" if i % 2 == 0 else "moderate"
                elif damage_class == "pothole":
                    severity = "moderate" if i % 2 == 0 else "critical"
                else: # waterlogging
                    severity = "moderate" if i % 3 != 0 else "critical"
                
                # Flag a couple of detections as incorrect to simulate human-in-the-loop flags
                is_incorrect = (i == 4 or i == 11)

                # Create detection record
                det = Detection(
                    timestamp=timestamp,
                    lat=loc["lat"],
                    lng=loc["lng"],
                    address=loc["address"],
                    damage_class=damage_class,
                    confidence=conf,
                    image_path=f"/static/uploads/{filename}",
                    is_verified=is_verified,
                    severity=severity,
                    is_incorrect=is_incorrect
                )
                db.add(det)
                
            db.commit()
            logger.info("Successfully seeded 20 geolocated road damage records with simulated images.")
        else:
            logger.info("Detections already seeded. Skipping detections.")
            
    except Exception as e:
        logger.exception(f"Seeding failed: {e}")
        db.rollback()
    finally:
        db.close()
        logger.info("Seeding script execution completed.")

if __name__ == "__main__":
    seed()
