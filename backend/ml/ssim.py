import math
import logging
import cv2
import numpy as np
from typing import Optional
from sqlalchemy.orm import Session
from backend.models.models import Detection

logger = logging.getLogger("pothole_detector.ssim")

def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """
    Computes geodesic distance between two points in meters using pure math.
    a = sin²(Δlat/2) + cos(lat1)·cos(lat2)·sin²(Δlng/2)
    distance = 2·R·asin(√a) where R = 6371000 metres
    """
    lat1_rad, lng1_rad, lat2_rad, lng2_rad = map(math.radians, [lat1, lng1, lat2, lng2])
    
    dlat = lat2_rad - lat1_rad
    dlng = lng2_rad - lng1_rad
    
    a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlng / 2)**2
    c = 2 * math.asin(math.sqrt(a))
    r = 6371000.0  # Earth's radius in meters
    return c * r

def get_street_name(address: Optional[str]) -> str:
    """
    Extracts the candidate street name from a reverse-geocoded address string.
    Identifies parts containing common street suffixes.
    """
    if not address or address.strip().lower() in ["location unknown", ""]:
        return ""
    
    parts = [p.strip().lower() for p in address.split(",")]
    street_keywords = [
        "road", "street", "st", "rd", "lane", "ln", "avenue", "ave", 
        "cross", "layout", "path", "highway", "way", "drive", "dr", 
        "place", "pl", "nagar", "sector"
    ]
    
    # Try to find a segment containing a street keyword
    for part in parts:
        if any(kw in part for kw in street_keywords):
            return part
            
    # Fallback to second segment if first is likely a house/building number
    if len(parts) > 1:
        return parts[1]
    return parts[0] if parts else ""

def find_nearest_detection(lat: float, lng: float, db: Session, radius_metres: float = 50.0) -> Optional[Detection]:
    """
    Queries the detections table for any prior detection within radius_metres of (lat, lng).
    If multiple exist, returns the one with the EARLIEST timestamp.
    """
    # Query all detections with valid coordinates
    detections = db.query(Detection).filter(
        Detection.lat.isnot(None),
        Detection.lng.isnot(None)
    ).all()
    
    matches = []
    for d in detections:
        dist = haversine_distance(lat, lng, d.lat, d.lng)
        if dist <= radius_metres:
            matches.append((dist, d))
            
    if not matches:
        return None
        
    # Sort primarily by timestamp (earliest first), and secondarily by distance
    # Tiebreaker: earliest timestamp
    matches.sort(key=lambda item: (item[1].timestamp, item[0]))
    return matches[0][1]

def run_ssim_comparison(img1: np.ndarray, img2: np.ndarray) -> float:
    """
    Resizes both images to 640x640, converts to grayscale, and computes SSIM.
    Returns float in range [0.0, 1.0].
    """
    # Resize to 640x640 as required
    img1_resized = cv2.resize(img1, (640, 640))
    img2_resized = cv2.resize(img2, (640, 640))
    
    gray1 = cv2.cvtColor(img1_resized, cv2.COLOR_BGR2GRAY)
    gray2 = cv2.cvtColor(img2_resized, cv2.COLOR_BGR2GRAY)
    
    # Convert to float64 for mathematical calculations
    img1_f = gray1.astype(np.float64)
    img2_f = gray2.astype(np.float64)
    
    # Constants for stability
    C1 = (0.01 * 255) ** 2
    C2 = (0.03 * 255) ** 2
    
    # Mean calculations via local 11x11 uniform filter
    kernel = np.ones((11, 11), np.float64) / 121.0
    mu1 = cv2.filter2D(img1_f, -1, kernel)
    mu2 = cv2.filter2D(img2_f, -1, kernel)
    
    mu1_sq = mu1 ** 2
    mu2_sq = mu2 ** 2
    mu1_mu2 = mu1 * mu2
    
    # Variance and covariance
    sigma1_sq = cv2.filter2D(img1_f ** 2, -1, kernel) - mu1_sq
    sigma2_sq = cv2.filter2D(img2_f ** 2, -1, kernel) - mu2_sq
    sigma12 = cv2.filter2D(img1_f * img2_f, -1, kernel) - mu1_mu2
    
    # SSIM formula
    num = (2 * mu1_mu2 + C1) * (2 * sigma12 + C2)
    den = (mu1_sq + mu2_sq + C1) * (sigma1_sq + sigma2_sq + C2)
    ssim_map = num / den
    
    ssim_score = float(np.mean(ssim_map))
    # Clip between 0.0 and 1.0 as specified
    return max(0.0, min(1.0, ssim_score))
