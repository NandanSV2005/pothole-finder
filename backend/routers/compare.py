"""
Router for Before/After road damage change detection.
Uses custom Structural Similarity Index (SSIM) and YOLOv8 analysis.
"""

import os
import uuid
import logging
import base64
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
import cv2
import numpy as np

from backend.routers.detections import detector

logger = logging.getLogger("pothole_detector.compare")
router = APIRouter(prefix="/api/detections/compare", tags=["Change Detection"])

def calculate_ssim(img1: np.ndarray, img2: np.ndarray) -> float:
    """
    Computes a simplified Structural Similarity Index (SSIM) between two grayscale images.
    Returns value in range [-1.0, 1.0], where 1.0 means identical images.
    """
    # Convert to float64 for mathematical calculations
    img1 = img1.astype(np.float64)
    img2 = img2.astype(np.float64)
    
    # Constants for stability
    C1 = (0.01 * 255) ** 2
    C2 = (0.03 * 255) ** 2
    
    # Mean calculations via local 11x11 uniform filter
    kernel = np.ones((11, 11), np.float64) / 121.0
    mu1 = cv2.filter2D(img1, -1, kernel)
    mu2 = cv2.filter2D(img2, -1, kernel)
    
    mu1_sq = mu1 ** 2
    mu2_sq = mu2 ** 2
    mu1_mu2 = mu1 * mu2
    
    # Variance and covariance
    sigma1_sq = cv2.filter2D(img1 ** 2, -1, kernel) - mu1_sq
    sigma2_sq = cv2.filter2D(img2 ** 2, -1, kernel) - mu2_sq
    sigma12 = cv2.filter2D(img1 * img2, -1, kernel) - mu1_mu2
    
    # SSIM formula
    num = (2 * mu1_mu2 + C1) * (2 * sigma12 + C2)
    den = (mu1_sq + mu2_sq + C1) * (sigma1_sq + sigma2_sq + C2)
    ssim_map = num / den
    
    return float(np.mean(ssim_map))

@router.post("")
async def compare_images(
    image_before: UploadFile = File(...),
    image_after: UploadFile = File(...)
):
    """
    Accepts before/after uploads of the same location, runs YOLOv8 on both,
    computes SSIM change index, and evaluates whether damage has worsened or been repaired.
    """
    # Verify detector
    local_detector = detector
    if local_detector is None:
        raise HTTPException(
            status_code=500,
            detail="YOLOv8 detector is not initialized."
        )

    # 1. Read files into OpenCV images
    contents_before = await image_before.read()
    contents_after = await image_after.read()
    
    np_b = np.frombuffer(contents_before, np.uint8)
    np_a = np.frombuffer(contents_after, np.uint8)
    
    img_b = cv2.imdecode(np_b, cv2.IMREAD_COLOR)
    img_a = cv2.imdecode(np_a, cv2.IMREAD_COLOR)
    
    if img_b is None or img_a is None:
        raise HTTPException(
            status_code=422,
            detail="One or both uploaded images are corrupted."
        )

    upload_dir = Path(os.getenv("UPLOAD_DIR", "backend/data/uploads"))
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    # Save files to run YOLODetector.detect (which expects file paths)
    compare_id = str(uuid.uuid4())
    temp_before_path = upload_dir / f"compare_b_{compare_id}.jpg"
    temp_after_path = upload_dir / f"compare_a_{compare_id}.jpg"
    
    with open(temp_before_path, "wb") as fb:
        fb.write(contents_before)
    with open(temp_after_path, "wb") as fa:
        fa.write(contents_after)

    try:
        # Run detection on both
        conf_threshold = float(os.getenv("CONFIDENCE_THRESHOLD", "0.4"))
        res_b = local_detector.detect(temp_before_path, conf_threshold=conf_threshold)
        res_a = local_detector.detect(temp_after_path, conf_threshold=conf_threshold)
    finally:
        # Cleanup temporary files
        if temp_before_path.exists():
            temp_before_path.unlink()
        if temp_after_path.exists():
            temp_after_path.unlink()

    # 2. Resize both images to same dimensions for SSIM calculation
    h, w = 480, 640
    img_b_resized = cv2.resize(img_b, (w, h))
    img_a_resized = cv2.resize(img_a, (w, h))
    
    gray_b = cv2.cvtColor(img_b_resized, cv2.COLOR_BGR2GRAY)
    gray_a = cv2.cvtColor(img_a_resized, cv2.COLOR_BGR2GRAY)
    
    # 3. Calculate SSIM
    ssim_score = calculate_ssim(gray_b, gray_a)
    
    # 4. Triage Change Status
    det_b = res_b["detections"]
    det_a = res_a["detections"]
    
    potholes_b = sum(1 for d in det_b if d["class"] in ["pothole", "road_collapse"])
    potholes_a = sum(1 for d in det_a if d["class"] in ["pothole", "road_collapse"])
    
    # Calculate box sizes (areas) for comparison
    area_b = 0.0
    for d in det_b:
        xmin, ymin, xmax, ymax = d["box"]
        area_b += (xmax - xmin) * (ymax - ymin)
        
    area_a = 0.0
    for d in det_a:
        xmin, ymin, xmax, ymax = d["box"]
        area_a += (xmax - xmin) * (ymax - ymin)

    # Status rules:
    # - If we had potholes before, but now we have none: Repaired
    # - If we have more potholes now than before: Worsened
    # - If we have the same or fewer potholes, but the area is significantly larger (>20% increase): Worsened
    # - If the area is significantly smaller (>20% decrease) and potholes decreased: Repaired
    # - If SSIM is high and no changes in potholes: No Change
    
    status_str = "No Change"
    if potholes_b > 0 and potholes_a == 0:
        status_str = "Repaired"
    elif potholes_a > potholes_b:
        status_str = "Worsened"
    elif potholes_a > 0 and area_a > (area_b * 1.20):
        status_str = "Worsened"
    elif potholes_b > 0 and area_a < (area_b * 0.80):
        status_str = "Repaired"
    elif ssim_score < 0.65 and potholes_a > 0:
        status_str = "Worsened"
    elif ssim_score < 0.65 and potholes_a == 0:
        status_str = "Repaired (Road repaved)"
    elif ssim_score >= 0.92:
        status_str = "No Change"

    # 5. Create side-by-side concatenated comparison image
    # We will use the annotated output images from YOLO
    anno_b_resized = cv2.resize(res_b["annotated_image"], (w, h))
    anno_a_resized = cv2.resize(res_a["annotated_image"], (w, h))
    
    # Concatenate side-by-side
    combined_img = cv2.hconcat([anno_b_resized, anno_a_resized])
    
    # Add status banners
    banner_h = 50
    banner = np.zeros((banner_h, w * 2, 3), dtype=np.uint8)
    banner[:] = (12, 16, 23) # dark slate theme background
    
    # Draw text on banner
    font = cv2.FONT_HERSHEY_SIMPLEX
    text_status = f"COMPARISON STATUS: {status_str.upper()}"
    text_ssim = f"SSIM Index: {ssim_score:.4f}"
    
    # Status text color: Repaired = Green, Worsened = Red, No Change = Yellow
    status_colors = {
        "repaired": (80, 175, 76),
        "repaired (road repaved)": (80, 175, 76),
        "worsened": (54, 67, 244)
    }
    col = status_colors.get(status_str.lower(), (0, 215, 255))
    
    cv2.putText(banner, text_status, (20, 32), font, 0.65, col, 2, cv2.LINE_AA)
    cv2.putText(banner, text_ssim, (w + 20, 32), font, 0.65, (220, 220, 220), 2, cv2.LINE_AA)
    
    # Combine banner with concatenated image
    output_image = cv2.vconcat([combined_img, banner])
    
    # Base64 encode side-by-side image for inline client rendering
    _, buffer = cv2.imencode('.jpg', output_image)
    base64_image = base64.b64encode(buffer).decode('utf-8')
    
    return {
        "success": True,
        "ssim": ssim_score,
        "status": status_str,
        "detections_before": len(det_b),
        "detections_after": len(det_a),
        "comparison_image_base64": f"data:image/jpeg;base64,{base64_image}"
    }
