"""
Router for Before/After road damage change detection.
Uses GPS coordinates, Haversine formula, and SSIM to automatically retrieve nearest prior detection.
"""

import os
import uuid
import logging
from pathlib import Path
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
import cv2
import numpy as np

from backend.database import get_db
from backend.models.models import Detection
from backend.schemas import CompareResponse
from backend.routers.detections import reverse_geocode, detector
from backend.ml.ssim import (
    find_nearest_detection,
    run_ssim_comparison,
    haversine_distance,
    get_street_name
)

logger = logging.getLogger("pothole_detector.compare")
# Register at /api/compare as required
router = APIRouter(prefix="/api/compare", tags=["Change Detection"])

def run_yolo_on_image(contents: bytes, upload_dir: Path) -> tuple:
    """
    Runs YOLOv8 on the raw image contents, saves the annotated image to disk,
    and returns a tuple: (detections list, annotated_image_filename, annotated_image_numpy).
    """
    local_detector = detector
    if local_detector is None:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "YOLOv8 detector is not initialized.",
                "code": "MODEL_NOT_READY",
                "suggestion": "Please contact system administrator to verify weights configuration."
            }
        )

    file_id = str(uuid.uuid4())
    temp_img_path = upload_dir / f"temp_compare_{file_id}.jpg"
    
    with open(temp_img_path, "wb") as f:
        f.write(contents)
        
    try:
        conf_threshold = float(os.getenv("CONFIDENCE_THRESHOLD", "0.4"))
        result = local_detector.detect(temp_img_path, conf_threshold=conf_threshold, timeout_seconds=30.0)
    except TimeoutError:
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
    finally:
        if temp_img_path.exists():
            temp_img_path.unlink()

    annotated_filename = f"annotated_compare_{file_id}.jpg"
    annotated_path = upload_dir / annotated_filename
    cv2.imwrite(str(annotated_path), result["annotated_image"])
    
    return result["detections"], annotated_filename, result["annotated_image"]

def save_detections_to_db(
    db: Session,
    lat: float,
    lng: float,
    address: str,
    detections: list,
    annotated_filename: str,
    is_baseline: bool,
    compared_to_detection_id: Optional[int] = None
) -> Detection:
    """
    Saves detections to db. If none are found, saves a fallback record to track the location.
    Returns the main saved detection database object.
    """
    saved_records = []
    
    if len(detections) > 0:
        for det in detections:
            db_detection = Detection(
                lat=lat,
                lng=lng,
                address=address,
                damage_class=det["class"],
                confidence=det["confidence"],
                image_path=f"/static/uploads/{annotated_filename}",
                is_verified=False,
                severity=det.get("severity", "minor"),
                is_incorrect=False,
                is_baseline=is_baseline,
                compared_to_detection_id=compared_to_detection_id
            )
            db.add(db_detection)
            db.commit()
            db.refresh(db_detection)
            saved_records.append(db_detection)
    else:
        # Fallback tracking record if no damage is detected
        db_detection = Detection(
            lat=lat,
            lng=lng,
            address=address,
            damage_class="none",
            confidence=1.0,
            image_path=f"/static/uploads/{annotated_filename}",
            is_verified=False,
            severity="minor",
            is_incorrect=False,
            is_baseline=is_baseline,
            compared_to_detection_id=compared_to_detection_id
        )
        db.add(db_detection)
        db.commit()
        db.refresh(db_detection)
        saved_records.append(db_detection)
        
    return saved_records[0]

@router.post("", response_model=CompareResponse)
async def compare_images(
    new_image: UploadFile = File(...),
    lat: Optional[float] = Form(None),
    lng: Optional[float] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Accepts a new road damage image and GPS coordinates, searches for nearby reports,
    runs SSIM comparison if a prior report is found, or saves it as a new baseline.
    """
    # 1. Database connection check
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

    # 2. GPS Validation Check
    if lat is None or lng is None:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Location access is required for automatic comparison. Please enable GPS and try again.",
                "code": "GPS_REQUIRED",
                "suggestion": "Please enable location access in your browser or device settings."
            }
        )

    # 3. File size limit check (>10MB)
    MAX_SIZE = 10 * 1024 * 1024
    contents = await new_image.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "error": "File size exceeds 10MB limit.",
                "code": "FILE_TOO_LARGE",
                "suggestion": "Please upload a road image smaller than 10MB."
            }
        )

    # 4. Decode new image
    nparr = np.frombuffer(contents, np.uint8)
    img_new = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img_new is None:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "The uploaded image is corrupted or invalid.",
                "code": "CORRUPTED_IMAGE",
                "suggestion": "Please upload a valid JPEG or PNG image."
            }
        )

    upload_dir = Path(os.getenv("UPLOAD_DIR", "backend/data/uploads"))
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    # 5. Geocode new location
    new_address = reverse_geocode(lat, lng)

    # 6. Find nearest prior detection within 50m
    prior_detection = find_nearest_detection(lat, lng, db, radius_metres=50.0)

    if prior_detection is not None:
        # Distance calculation
        dist = haversine_distance(lat, lng, prior_detection.lat, prior_detection.lng)
        
        # Verify if prior image exists on disk
        prior_filename = prior_detection.image_path.split("/")[-1]
        prior_file_path = upload_dir / prior_filename
        
        # Determine confidence
        street_new = get_street_name(new_address)
        street_old = get_street_name(prior_detection.address)
        street_match = False
        if street_new and street_old:
            if street_new in street_old or street_old in street_new:
                street_match = True
                
        if street_match:
            location_confidence = "high" if dist <= 20.0 else "medium"
        else:
            location_confidence = "medium" if dist <= 15.0 else "low"

        # Handle missing old image file
        if not prior_file_path.exists():
            # Save new image as baseline anyway
            new_detections, annotated_filename, _ = run_yolo_on_image(contents, upload_dir)
            new_db_rec = save_detections_to_db(
                db=db,
                lat=lat,
                lng=lng,
                address=new_address,
                detections=new_detections,
                annotated_filename=annotated_filename,
                is_baseline=True,
                compared_to_detection_id=None
            )
            return CompareResponse(
                status="compared",
                new_detection_id=str(new_db_rec.id),
                prior_detection_id=str(prior_detection.id),
                prior_detection_date=prior_detection.timestamp.isoformat() + "Z" if not prior_detection.timestamp.isoformat().endswith("Z") else prior_detection.timestamp.isoformat(),
                distance_metres=dist,
                location_confidence="low",
                ssim_score=None,
                verdict="prior_image_unavailable",
                verdict_explanation="Prior report was found nearby but its image was missing from the server. Saved the new image as a new baseline.",
                old_image_url=None,
                new_image_url=new_db_rec.image_path,
                prior_detection_address=prior_detection.address,
                new_detection_address=new_address,
                prior_detection_severity=prior_detection.severity
            )

        # Run YOLO on new image
        new_detections, annotated_filename, img_new_annotated = run_yolo_on_image(contents, upload_dir)

        # Try to run SSIM
        try:
            img_old = cv2.imread(str(prior_file_path), cv2.IMREAD_COLOR)
            if img_old is None:
                raise ValueError("Could not read prior image file from disk")
                
            ssim_score = run_ssim_comparison(img_old, img_new)
        except Exception as ssim_err:
            logger.error(f"SSIM comparison failed: {ssim_err}")
            # Save new image as baseline anyway
            new_db_rec = save_detections_to_db(
                db=db,
                lat=lat,
                lng=lng,
                address=new_address,
                detections=new_detections,
                annotated_filename=annotated_filename,
                is_baseline=True,
                compared_to_detection_id=None
            )
            raise HTTPException(
                status_code=422,
                detail={
                    "error": "Comparison failed but your report has been saved.",
                    "code": "COMPARISON_FAILED",
                    "suggestion": "The images could not be compared, but the new image has been saved as a baseline for future comparisons."
                }
            )

        # SSIM Thresholds Triage
        if ssim_score >= 0.85:
            verdict = "repaired"
            explanation = f"Road surface at this location looks significantly improved compared to the report from {prior_detection.timestamp.strftime('%Y-%m-%d')}. Marked as likely repaired."
        elif ssim_score >= 0.60:
            verdict = "unchanged"
            explanation = f"Road condition appears similar to the report from {prior_detection.timestamp.strftime('%Y-%m-%d')}. No significant change detected."
        else:
            verdict = "worsened"
            explanation = f"Road surface shows increased damage compared to the report from {prior_detection.timestamp.strftime('%Y-%m-%d')}. Severity may have escalated."

        # Save compared detection to database
        new_db_rec = save_detections_to_db(
            db=db,
            lat=lat,
            lng=lng,
            address=new_address,
            detections=new_detections,
            annotated_filename=annotated_filename,
            is_baseline=False,
            compared_to_detection_id=prior_detection.id
        )

        return CompareResponse(
            status="compared",
            new_detection_id=str(new_db_rec.id),
            prior_detection_id=str(prior_detection.id),
            prior_detection_date=prior_detection.timestamp.isoformat() + "Z" if not prior_detection.timestamp.isoformat().endswith("Z") else prior_detection.timestamp.isoformat(),
            distance_metres=round(dist, 2),
            location_confidence=location_confidence,
            ssim_score=ssim_score,
            verdict=verdict,
            verdict_explanation=explanation,
            old_image_url=prior_detection.image_path,
            new_image_url=new_db_rec.image_path,
            prior_detection_address=prior_detection.address,
            new_detection_address=new_address,
            prior_detection_severity=prior_detection.severity
        )

    else:
        # 9. No prior detection found -> baseline_saved
        new_detections, annotated_filename, _ = run_yolo_on_image(contents, upload_dir)
        new_db_rec = save_detections_to_db(
            db=db,
            lat=lat,
            lng=lng,
            address=new_address,
            detections=new_detections,
            annotated_filename=annotated_filename,
            is_baseline=True,
            compared_to_detection_id=None
        )

        return CompareResponse(
            status="baseline_saved",
            new_detection_id=str(new_db_rec.id),
            prior_detection_id=None,
            prior_detection_date=None,
            distance_metres=None,
            location_confidence=None,
            ssim_score=None,
            verdict="new_baseline",
            verdict_explanation="No prior report found within 50m of this location. Saved as a new baseline — future uploads here will be compared against this image.",
            old_image_url=None,
            new_image_url=new_db_rec.image_path,
            prior_detection_address=None,
            new_detection_address=new_address,
            prior_detection_severity=None
        )
