"""
Pydantic schemas for request validation and response serialization.
"""

from datetime import datetime
from typing import List, Optional, Dict
from pydantic import BaseModel, Field

# --- AUTH SCHEMAS ---

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    role: Optional[str] = Field("citizen", pattern="^(admin|citizen)$")

class UserResponse(BaseModel):
    id: int
    username: str
    role: str

    class Config:
        from_attributes = True

class LoginRequest(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

# --- DETECTION SCHEMAS ---

class DetectionCreate(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None
    damage_class: str
    confidence: float
    address: Optional[str] = None
    image_path: str
    severity: Optional[str] = "minor"

class DetectionResponse(BaseModel):
    id: int
    timestamp: datetime
    lat: Optional[float] = None
    lng: Optional[float] = None
    address: Optional[str] = None
    damage_class: str
    confidence: float
    image_path: str
    is_verified: bool
    severity: str
    is_incorrect: bool

    class Config:
        from_attributes = True

class PaginatedDetectionsResponse(BaseModel):
    total: int
    page: int
    limit: int
    items: List[DetectionResponse]

# --- STATS SCHEMAS ---

class DamageCount(BaseModel):
    damage_class: str
    count: int

class HotspotArea(BaseModel):
    area: str
    count: int

class StatsResponse(BaseModel):
    total_detections_today: int
    total_detections_all_time: int
    by_type: List[DamageCount]
    hotspots: List[HotspotArea]

# --- ANALYTICS SCHEMAS ---

class ClassConfidence(BaseModel):
    damage_class: str
    avg_confidence: float

class PrecisionTrendPoint(BaseModel):
    date: str
    precision: float

class AnalyticsResponse(BaseModel):
    average_confidence: List[ClassConfidence]
    false_positive_rate: float
    precision_trend: List[PrecisionTrendPoint]

# --- ERROR SCHEMA ---

class ErrorResponse(BaseModel):
    error: str
    code: str
    suggestion: str
