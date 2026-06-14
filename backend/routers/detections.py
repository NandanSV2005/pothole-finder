"""
Router for road damage detections.
Handles upload, YOLOv8 inference, geocoding, and DB persistence.
"""

import os
import uuid
import logging
import base64
from datetime import datetime
from pathlib import Path
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError, SQLAlchemyError
import cv2
import numpy as np

from geopy.geocoders import Nominatim
from backend.database import get_db
from backend.models.models import Detection, User
from backend.schemas import DetectionResponse, PaginatedDetectionsResponse, ErrorResponse
from backend.auth import get_admin_user, get_current_user
from backend.ml.detector import YOLODetector, DAMAGE_CLASSES

logger = logging.getLogger("pothole_detector.detections")

router = APIRouter(prefix="/api/detections", tags=["Detections"])

# Initialize detector
MODEL_PATH = os.getenv("MODEL_PATH", "weights/yolov8n.pt")
detector: Optional[YOLODetector] = None
try:
    detector = YOLODetector(MODEL_PATH)
except Exception as e:
    logger.critical(f"Failed to initialize detector: {e}")

# Initialize Geopy Geolocator
GEOPY_USER_AGENT = os.getenv("GEOPY_USER_AGENT", "pothole_detector_civic_dashboard_v1")
# We specify a custom user agent to satisfy OpenStreetMap policy
geolocator = Nominatim(user_agent=GEOPY_USER_AGENT)

def reverse_geocode(lat: Optional[float], lng: Optional[float]) -> str:
    """Helper to convert coordinates to human-readable address using geopy."""
    if lat is None or lng is None:
        return "location unknown"
    try:
        # Nominatim reverse geocode
        location = geolocator.reverse((lat, lng), timeout=5)
        if location and location.address:
            return location.address
        return f"Coordinates: {lat:.5f}, {lng:.5f}"
    except Exception as e:
        logger.warning(f"Geopy reverse geocoding failed: {e}")
        return f"Coordinates: {lat:.5f}, {lng:.5f}"

# Main detection upload endpoint is specified as POST /api/detect (at the root api level)
# Let's define it inside this file but we can map it to /api/detect in main.py
# Or define it here with route "/detect" relative to prefix, but let's make a separate route in main.py,
# or define it here as a custom path. Let's register it as POST /api/detect directly in main.py pointing to this handler.

async def detect_road_damage(
    file: UploadFile = File(...),
    lat: Optional[float] = Form(None),
    lng: Optional[float] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Main inference endpoint.
    Accepts image file and coordinates, runs YOLOv8, annotates, and saves to database.
    """
    # 1. Error Handling: Database connection check
    try:
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
    except Exception as db_err:
        logger.error(f"Database connection check failed: {db_err}")
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Database connection failed.",
                "code": "DATABASE_ERROR",
                "suggestion": "The system database is temporarily unavailable. Please try again later."
            }
        )

    # 2. Error Handling: File size limit check (>10MB)
    MAX_SIZE = 10 * 1024 * 1024 # 10MB
    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "File size exceeds 10MB limit.",
                "code": "FILE_TOO_LARGE",
                "suggestion": "Please upload an image or video frame smaller than 10MB."
            }
        )

    # Reset file pointer or just use the read contents
    # Let's decode the image using OpenCV from memory
    nparr = np.frombuffer(contents, np.uint8)
    
    # 3. Error Handling: Corrupted image check
    try:
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError("cv2.imdecode returned None")
    except Exception as cv_err:
        logger.error(f"Corrupted image upload: {cv_err}")
        raise HTTPException(
            status_code=422,
            detail={
                "error": "The uploaded image is corrupted or invalid.",
                "code": "CORRUPTED_IMAGE",
                "suggestion": "Please upload a valid JPEG or PNG image."
            }
        )

    # 4. Create paths and save original file
    upload_dir = Path(os.getenv("UPLOAD_DIR", "backend/data/uploads"))
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    file_id = str(uuid.uuid4())
    ext = Path(file.filename).suffix or ".jpg"
    if ext.lower() not in [".jpg", ".jpeg", ".png"]:
        ext = ".jpg"
        
    temp_img_path = upload_dir / f"temp_{file_id}{ext}"
    with open(temp_img_path, "wb") as f:
        f.write(contents)

    # 5. Run Inference with timeout check
    local_detector = detector
    if local_detector is None:
        # Clean up temp file
        if temp_img_path.exists():
            temp_img_path.unlink()
        raise HTTPException(
            status_code=500,
            detail={
                "error": "YOLOv8 detector is not initialized.",
                "code": "MODEL_NOT_READY",
                "suggestion": "Please contact system administrator to verify weights configuration."
            }
        )

    try:
        conf_threshold = float(os.getenv("CONFIDENCE_THRESHOLD", "0.4"))
        # We invoke detector.detect which has built-in thread-pool timeout
        result = local_detector.detect(temp_img_path, conf_threshold=conf_threshold, timeout_seconds=30.0)
    except TimeoutError as te:
        if temp_img_path.exists():
            temp_img_path.unlink()
        raise HTTPException(
            status_code=408,
            detail={
                "error": "Model inference took longer than 30 seconds.",
                "code": "INFERENCE_TIMEOUT",
                "suggestion": "The server is busy. Please try again in a few moments."
            }
        )
    except Exception as e:
        if temp_img_path.exists():
            temp_img_path.unlink()
        logger.error(f"Model inference exception: {e}")
        raise HTTPException(
            status_code=422,
            detail={
                "error": f"Failed to complete model inference: {str(e)}",
                "code": "INFERENCE_FAILED",
                "suggestion": "Please verify if the image contains valid road views."
            }
        )

    # Save annotated image
    annotated_filename = f"annotated_{file_id}.jpg"
    annotated_path = upload_dir / annotated_filename
    cv2.imwrite(str(annotated_path), result["annotated_image"])

    # Clean up temp image
    if temp_img_path.exists():
        temp_img_path.unlink()

    # 6. Geolocation & Reverse Geocoding
    # No GPS available: accept null lat/lng, mark as "location unknown"
    address = "location unknown"
    if lat is not None and lng is not None:
        address = reverse_geocode(lat, lng)

    # 7. Persist Detections in Database
    detections_found = result["detections"]
    saved_records = []

    try:
        if len(detections_found) > 0:
            for det in detections_found:
                db_detection = Detection(
                    lat=lat,
                    lng=lng,
                    address=address,
                    damage_class=det["class"],
                    confidence=det["confidence"],
                    image_path=f"/static/uploads/{annotated_filename}",
                    is_verified=False,
                    severity=det.get("severity", "minor"),
                    is_incorrect=False
                )
                db.add(db_detection)
                db.commit()
                db.refresh(db_detection)
                saved_records.append(db_detection)
        else:
            # If no damage is detected, we don't save to db by default, or we can save an entry.
            # The prompt says: "Runs YOLOv8 inference, returns bounding boxes + confidence scores + damage class...
            # Store: detection_id, timestamp, lat, lng, address, damage_class, confidence, image_path in SQLite"
            # We will return empty list in JSON.
            pass
    except SQLAlchemyError as sae:
        logger.error(f"SQLAlchemy commit failed: {sae}")
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Failed to save detections to database.",
                "code": "DATABASE_ERROR",
                "suggestion": "Database transaction failed. Please retry."
            }
        )

    # Base64 encode the annotated image for inline display in response
    _, buffer = cv2.imencode('.jpg', result["annotated_image"])
    base64_image = base64.b64encode(buffer).decode('utf-8')

    return {
        "success": True,
        "message": f"Detected {len(saved_records)} road damage instances." if len(saved_records) > 0 else "No road damage detected.",
        "detections": saved_records,
        "annotated_image_base64": f"data:image/jpeg;base64,{base64_image}"
    }

# --- Standard REST Endpoints ---

@router.get("", response_model=PaginatedDetectionsResponse)
def get_detections(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    damage_class: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    area: Optional[str] = Query(None),
    min_confidence: Optional[float] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Retrieves a paginated list of detections with filtering.
    """
    query = db.query(Detection)

    # Apply Filters
    if damage_class:
        query = query.filter(Detection.damage_class == damage_class)
        
    if min_confidence:
        query = query.filter(Detection.confidence >= min_confidence)
        
    if area:
        # Case insensitive address search
        query = query.filter(Detection.address.ilike(f"%{area}%"))

    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date)
            query = query.filter(Detection.timestamp >= start_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use ISO format (YYYY-MM-DD).")
            
    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date)
            query = query.filter(Detection.timestamp <= end_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use ISO format (YYYY-MM-DD).")

    # Order by newest
    query = query.order_by(Detection.timestamp.desc())

    # Pagination
    total = query.count()
    offset = (page - 1) * limit
    items = query.offset(offset).limit(limit).all()

    return PaginatedDetectionsResponse(
        total=total,
        page=page,
        limit=limit,
        items=items
    )

@router.get("/{id}", response_model=DetectionResponse)
def get_detection(id: int, db: Session = Depends(get_db)):
    """
    Retrieve details of a single detection.
    """
    detection = db.query(Detection).filter(Detection.id == id).first()
    if not detection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Detection with ID {id} not found."
        )
    return detection

@router.post("/{id}/verify", response_model=DetectionResponse)
def verify_detection(id: int, db: Session = Depends(get_db), _current_user: User = Depends(get_admin_user)):
    """
    Mark a detection as verified. Restricted to Administrators.
    """
    detection = db.query(Detection).filter(Detection.id == id).first()
    if not detection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Detection with ID {id} not found."
        )
    
    detection.is_verified = True
    db.commit()
    db.refresh(detection)
    return detection

@router.delete("/{id}", status_code=status.HTTP_200_OK)
def delete_detection(id: int, db: Session = Depends(get_db), _current_user: User = Depends(get_admin_user)):
    """
    Delete a detection. Restricted to Administrators.
    """
    detection = db.query(Detection).filter(Detection.id == id).first()
    if not detection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Detection with ID {id} not found."
        )
    
    # Try to delete associated annotated image file
    if detection.image_path.startswith("/static/uploads/"):
        filename = detection.image_path.split("/")[-1]
        file_path = Path(os.getenv("UPLOAD_DIR", "backend/data/uploads")) / filename
        try:
            if file_path.exists():
                file_path.unlink()
        except Exception as e:
            logger.warning(f"Failed to delete physical image file: {e}")

    db.delete(detection)
    db.commit()
    return {"message": f"Detection with ID {id} has been deleted successfully."}

@router.post("/{id}/flag", response_model=DetectionResponse)
def flag_detection(id: int, db: Session = Depends(get_db)):
    """
    Flag a detection as incorrect (human-in-the-loop ML correction feed).
    """
    detection = db.query(Detection).filter(Detection.id == id).first()
    if not detection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Detection with ID {id} not found."
        )
    detection.is_incorrect = True
    db.commit()
    db.refresh(detection)
    return detection

@router.post("/video")
async def process_video_detections(
    file: UploadFile = File(...),
    frame_interval: int = Form(10),
    lat: Optional[float] = Form(None),
    lng: Optional[float] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Process an uploaded dashcam video frame-by-frame.
    Runs YOLOv8 and severity engine on every N-th frame, interpolates coordinates,
    and returns a timeline of detected incidents.
    """
    # Verify file extension
    ext = Path(file.filename).suffix.lower()
    if ext not in [".mp4", ".avi", ".mov", ".mkv"]:
        raise HTTPException(status_code=400, detail="Unsupported video format. Please upload an MP4, AVI, MOV or MKV file.")

    # Save video locally
    upload_dir = Path(os.getenv("UPLOAD_DIR", "backend/data/uploads"))
    upload_dir.mkdir(parents=True, exist_ok=True)
    video_id = str(uuid.uuid4())
    temp_video_path = upload_dir / f"temp_video_{video_id}{ext}"
    
    contents = await file.read()
    with open(temp_video_path, "wb") as f:
        f.write(contents)

    cap = cv2.VideoCapture(str(temp_video_path))
    if not cap.isOpened():
        if temp_video_path.exists():
            temp_video_path.unlink()
        raise HTTPException(status_code=422, detail="Failed to open uploaded video file.")

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0:
        fps = 30.0 # fallback

    start_lat = lat if lat is not None else 12.9716
    start_lng = lng if lng is not None else 77.5946
    start_address = reverse_geocode(start_lat, start_lng)

    timeline_events = []
    total_detections_count = 0
    frame_count = 0
    local_detector = detector

    if local_detector is None:
        cap.release()
        if temp_video_path.exists():
            temp_video_path.unlink()
        raise HTTPException(status_code=500, detail="Detector is not initialized.")

    try:
        conf_threshold = float(os.getenv("CONFIDENCE_THRESHOLD", "0.4"))
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
                
            if frame_count % frame_interval == 0:
                # Save frame image temporarily
                temp_frame_path = upload_dir / f"temp_frame_{video_id}_{frame_count}.jpg"
                cv2.imwrite(str(temp_frame_path), frame)
                
                # Run detection on this frame
                result = local_detector.detect(temp_frame_path, conf_threshold=conf_threshold, timeout_seconds=15.0)
                
                # Delete temp frame
                if temp_frame_path.exists():
                    temp_frame_path.unlink()
                
                det_results = result["detections"]
                if len(det_results) > 0:
                    seconds = frame_count / fps
                    # Interpolate driving coordinates (driving north-east at ~30km/h: ~0.00008 deg per second)
                    current_lat = start_lat + (seconds * 0.00008)
                    current_lng = start_lng + (seconds * 0.00008)
                    
                    # Generate localized address text
                    address = f"{start_address.split(',')[0]} (Drive Route + {int(seconds)}s)"
                    
                    # Write detections to DB and save frame images
                    annotated_filename = f"frame_{video_id}_{frame_count}.jpg"
                    annotated_path = upload_dir / annotated_filename
                    cv2.imwrite(str(annotated_path), result["annotated_image"])
                    
                    frame_detections = []
                    for det in det_results:
                        db_detection = Detection(
                            lat=current_lat,
                            lng=current_lng,
                            address=address,
                            damage_class=det["class"],
                            confidence=det["confidence"],
                            image_path=f"/static/uploads/{annotated_filename}",
                            is_verified=False,
                            severity=det["severity"],
                            is_incorrect=False
                        )
                        db.add(db_detection)
                        frame_detections.append(db_detection)
                        total_detections_count += 1
                    
                    db.commit()
                    for d in frame_detections:
                        db.refresh(d)
                    
                    # Add to response timeline
                    timeline_events.append({
                        "time": f"{int(seconds // 60)}:{int(seconds % 60):02d}",
                        "seconds": round(seconds, 2),
                        "lat": current_lat,
                        "lng": current_lng,
                        "address": address,
                        "image_path": f"/static/uploads/{annotated_filename}",
                        "detections": [
                            {
                                "id": d.id,
                                "damage_class": d.damage_class,
                                "confidence": d.confidence,
                                "severity": d.severity
                            } for d in frame_detections
                        ]
                    })
            
            frame_count += 1
            
    except Exception as err:
        logger.exception(f"Error during video processing: {err}")
        raise HTTPException(status_code=500, detail=f"Failed to complete video processing: {str(err)}")
    finally:
        cap.release()
        if temp_video_path.exists():
            temp_video_path.unlink()

    return {
        "success": True,
        "total_detections": total_detections_count,
        "timeline": timeline_events
    }
