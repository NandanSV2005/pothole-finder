"""
Main FastAPI application file.
Bootstraps the backend, configures CORS, registers routers, and sets up custom error handlers.
"""

import os
import logging
from pathlib import Path
from dotenv import load_dotenv

from fastapi import FastAPI, Depends, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend.database import engine, Base
from backend.routers import auth, detections, stats, reports, compare
from backend.routers.detections import detect_road_damage

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("pothole_detector.main")

# Load environment variables
env_path = Path(__file__).resolve().parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()

# Initialize DB tables
try:
    logger.info("Initializing database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialized successfully.")
except Exception as e:
    logger.error(f"Failed to initialize database tables: {e}")

app = FastAPI(
    title="Pothole and Road Damage Detection API",
    description="Backend service for detecting, classifying and logging road anomalies.",
    version="1.0.0"
)

# CORS configuration
# Allowing all in development, restrict in production if necessary
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create upload directory and mount StaticFiles
upload_dir = Path(os.getenv("UPLOAD_DIR", "backend/data/uploads"))
upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/static/uploads", StaticFiles(directory=str(upload_dir)), name="uploads")
app.mount("/static/detections", StaticFiles(directory=str(upload_dir)), name="detections")


# ERROR HANDLING OVERRIDES
# Requirement: All errors must return JSON {error: string, code: string, suggestion: string}

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    logger.warning(f"HTTP Exception: {exc.status_code} - {exc.detail}")
    
    # Check if exc.detail is already structured
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.detail
        )
        
    # Standard formatting fallback
    code_map = {
        status.HTTP_401_UNAUTHORIZED: "AUTH_UNAUTHORIZED",
        status.HTTP_403_FORBIDDEN: "AUTH_FORBIDDEN",
        status.HTTP_404_NOT_FOUND: "RESOURCE_NOT_FOUND",
        status.HTTP_405_METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
    }
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": str(exc.detail),
            "code": code_map.get(exc.status_code, f"HTTP_ERROR_{exc.status_code}"),
            "suggestion": "Please double-check your input parameters or path."
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(f"Validation Error: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "Request data validation failed.",
            "code": "VALIDATION_ERROR",
            "suggestion": "Please ensure you have supplied all required query parameters or body payloads in correct types."
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled system error: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "An unexpected server error occurred.",
            "code": "INTERNAL_SERVER_ERROR",
            "suggestion": "The server is experiencing temporary technical difficulties. Please try again later."
        }
    )

# REGISTER ROUTERS
# Map main detect endpoint to /api/detect directly (POST /api/detect)
app.add_api_route(
    "/api/detect",
    detect_road_damage,
    methods=["POST"],
    response_description="Process upload for road damage and return detections",
    tags=["Inference"]
)

# Standard REST endpoints
# Standard REST endpoints
app.include_router(auth.router)
app.include_router(detections.router)
app.include_router(stats.router)
app.include_router(reports.router)
app.include_router(compare.router)

# Serve built React frontend if available in production/Docker
frontend_dir = Path(__file__).resolve().parent / "frontend/dist"
if not frontend_dir.exists():
    # Fallback to root path in parent directory (monorepo layout)
    frontend_dir = Path(__file__).resolve().parent.parent / "frontend/dist"

if frontend_dir.exists():
    logger.info(f"Mounting frontend assets from {frontend_dir}")
    app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")
else:
    logger.warning("Frontend build directory not found. Serving API root placeholder.")
    @app.get("/")
    def read_root():
        return {"message": "Pothole and Road Damage Detection API is online. Frontend assets not built."}
