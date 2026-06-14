"""
Router for dashboard statistics.
"""

from datetime import datetime, time as datetime_time, timezone
from typing import Dict, List
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.models import Detection
from backend.schemas import StatsResponse, DamageCount, HotspotArea, AnalyticsResponse, ClassConfidence, PrecisionTrendPoint
from datetime import timedelta

router = APIRouter(prefix="/api/stats", tags=["Statistics"])

# List of common neighborhoods in Bengaluru to match in the address string
BENGALURU_AREAS = [
    "Indiranagar", "Koramangala", "Jayanagar", "Whitefield", "HSR Layout", 
    "Malleshwaram", "Hebbal", "Yelahanka", "Marathahalli", "BTM Layout", 
    "Rajajinagar", "Sadashivanagar", "Electronic City", "Bellandur", "Banashankari",
    "Ulsoor", "Basavanagudi", "Domlur", "Kalyan Nagar", "Richmond Town"
]

@router.get("", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db)):
    """
    Get aggregated dashboard stats: total count today, total all-time, counts by type, and hotspot areas.
    """
    # 1. Total All Time
    total_all_time = db.query(Detection).count()

    # 2. Total Today (UTC time range start)
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    total_today = db.query(Detection).filter(Detection.timestamp >= today_start).count()

    # 3. By Type breakdown
    type_counts = db.query(
        Detection.damage_class, 
        func.count(Detection.id).label("count")
    ).group_by(Detection.damage_class).all()
    
    # Map type_counts to schemas.DamageCount list, ensuring all 4 classes are represented even with 0 counts
    classes_found = {tc[0]: tc[1] for tc in type_counts}
    by_type = []
    for dmg_cls in ["pothole", "crack", "waterlogging", "road_collapse"]:
        by_type.append(DamageCount(
            damage_class=dmg_cls,
            count=classes_found.get(dmg_cls, 0)
        ))

    # 4. Hotspots (Grouping by Bengaluru neighborhoods present in the address string)
    detections = db.query(Detection.address).filter(Detection.address.isnot(None)).all()
    
    area_counts: Dict[str, int] = {}
    for (address,) in detections:
        matched = False
        for area in BENGALURU_AREAS:
            if area.lower() in address.lower():
                area_counts[area] = area_counts.get(area, 0) + 1
                matched = True
                break
        
        if not matched:
            # Fallback: take the second or first part of address if available, or keep it as "Other"
            parts = address.split(",")
            if len(parts) > 1 and len(parts[1].strip()) > 3:
                cand = parts[1].strip()
                # Skip common words like "Bengaluru" or state name
                if "bengaluru" not in cand.lower() and "bangalore" not in cand.lower() and "karnataka" not in cand.lower() and "india" not in cand.lower():
                    area_counts[cand] = area_counts.get(cand, 0) + 1
                    matched = True
            
            if not matched:
                area_counts["Other Areas"] = area_counts.get("Other Areas", 0) + 1

    # Sort hotspot list by count descending
    sorted_hotspots = sorted(area_counts.items(), key=lambda x: x[1], reverse=True)
    hotspots = [HotspotArea(area=k, count=v) for k, v in sorted_hotspots[:5]] # Top 5 hotspots

    return StatsResponse(
        total_detections_today=total_today,
        total_detections_all_time=total_all_time,
        by_type=by_type,
        hotspots=hotspots
    )

@router.get("/analytics", response_model=AnalyticsResponse)
def get_analytics(db: Session = Depends(get_db)):
    """
    Get deep analytics: average confidence by type, false positive rate, and precision trends.
    """
    # 1. Average confidence by damage type
    # Only calculate for correct detections (is_incorrect == False)
    avg_conf_query = db.query(
        Detection.damage_class,
        func.avg(Detection.confidence).label("avg_conf")
    ).filter(Detection.is_incorrect == False).group_by(Detection.damage_class).all()
    
    avg_conf_map = {row[0]: float(row[1]) for row in avg_conf_query if row[1] is not None}
    
    average_confidence = []
    for dmg_cls in ["pothole", "crack", "waterlogging", "road_collapse"]:
        average_confidence.append(ClassConfidence(
            damage_class=dmg_cls,
            avg_confidence=round(avg_conf_map.get(dmg_cls, 0.82), 4) # fallback/default if no data
        ))
        
    # 2. False positive rate
    total_count = db.query(Detection).count()
    flagged_count = db.query(Detection).filter(Detection.is_incorrect == True).count()
    
    false_positive_rate = flagged_count / total_count if total_count > 0 else 0.0
    
    # 3. Precision trend over the last 30 days
    precision_trend = []
    today = datetime.now(timezone.utc).date()
    
    # Sort detections by timestamp to calculate a running total
    all_dets = db.query(Detection.timestamp, Detection.is_incorrect).order_by(Detection.timestamp.asc()).all()
    
    for i in range(29, -1, -1):
        target_date = today - timedelta(days=i)
        
        # Count cumulative detections up to target_date EOD
        total_up_to_date = 0
        incorrect_up_to_date = 0
        
        for det_time, is_inc in all_dets:
            det_date = det_time.date()
            if det_date <= target_date:
                total_up_to_date += 1
                if is_inc:
                    incorrect_up_to_date += 1
                    
        correct_up_to_date = total_up_to_date - incorrect_up_to_date
        precision = correct_up_to_date / total_up_to_date if total_up_to_date > 0 else 1.0
        
        precision_trend.append(PrecisionTrendPoint(
            date=target_date.strftime("%b %d"),
            precision=round(precision, 4)
        ))
        
    return AnalyticsResponse(
        average_confidence=average_confidence,
        false_positive_rate=round(false_positive_rate, 4),
        precision_trend=precision_trend
    )
