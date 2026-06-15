"""
SQLAlchemy models for User and Detection.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey
from backend.database import Base

class User(Base):
    """
    User model for authentication and access control.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="citizen", nullable=False) # "admin" or "citizen"

class Detection(Base):
    """
    Detection model for road damage incidents.
    """
    __tablename__ = "detections"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True, nullable=False)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    address = Column(String, nullable=True)
    damage_class = Column(String, index=True, nullable=False) # pothole, crack, waterlogging, road_collapse
    confidence = Column(Float, nullable=False)
    image_path = Column(String, nullable=False) # Path to the stored annotated image
    is_verified = Column(Boolean, default=False, nullable=False) # Verified by admin
    severity = Column(String, default="minor", nullable=False) # minor, moderate, critical
    is_incorrect = Column(Boolean, default=False, nullable=False) # Flagged as incorrect by users
    is_baseline = Column(Boolean, default=False, nullable=False)
    compared_to_detection_id = Column(Integer, ForeignKey("detections.id"), nullable=True)

