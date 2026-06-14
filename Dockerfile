# ==========================================
# Stage 1: Build the React Frontend
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy frontend config files
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --legacy-peer-deps

# Copy frontend source and build
COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Build the Python Backend & Package
# ==========================================
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies for OpenCV and YOLOv8
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend application source
COPY backend/ ./backend/

# Copy compiled frontend from Stage 1 into the project folder
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create weights folder and data uploads folder, and grant write permissions to non-root containers
RUN mkdir -p weights backend/data/uploads && chmod -R 777 weights backend

# Expose port (7860 is default for Hugging Face Spaces, 8000 for local)
EXPOSE 8000

# Set environment variables
ENV PORT=8000
ENV DATABASE_URL=sqlite:///./pothole_detector.db
ENV UPLOAD_DIR=backend/data/uploads
ENV MODEL_PATH=weights/yolov8n.pt
ENV PYTHONPATH=/app

# Start the uvicorn application
CMD python -m uvicorn backend.main:app --host 0.0.0.0 --port $PORT
