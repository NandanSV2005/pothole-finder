# RoadSense: Pothole & Road Damage Detection System

RoadSense is a production-ready, full-stack civic technology application designed to detect, classify, log, and map road anomalies (potholes, cracks, waterlogging, and road collapses) across Bengaluru. It features a YOLOv8-powered ML pipeline, a FastAPI backend with SQLite database tracking, and a premium React Leaflet map dashboard for municipal analytics and citizens report filing.

## == ARCHITECTURE DIAGRAM ==

```
+-------------------------------------------------------------------------+
|                          ROADSENSE CIVIC TECH                           |
+-------------------------------------------------------------------------+
                                     |
                                     v
+------------------+     +-----------------------+     +------------------+
| CITIZENS REPORTS | --> |    REACT FRONTEND     | <-- |   MUNICIPALITY   |
| (Mobile Camera)  |     |  (Leaflet, Tailwind)  |     | (Verifies Cases) |
+------------------+     +-----------------------+     +------------------+
                                     |
                         JSON Payload / Multi-part
                                     |
                                     v
+-------------------------------------------------------------------------+
|                             FASTAPI BACKEND                             |
+-------------------------------------------------------------------------+
      |                       |                       |             |
      v                       v                       v             v
+-----------+          +-------------+          +-----------+  +----------+
|  YOLOv8   |          |    GEOPY    |          | REPORTLAB |  |  SQLITE  |
| ML Layer  |          | Reverse-Geo |          | PDF Comp  |  | Database |
+-----------+          +-------------+          +-----------+  +----------+
```

---

## Key Features

1. **AI Inference Pipeline**: Processes JPG/PNG uploads through a pre-trained or custom YOLOv8n model, returning annotations drawn dynamically by OpenCV.
2. **Geospatial Logging**: Extracts GPS coordinates via browser Geolocation API on submission, reverse-geocoding them into human-readable Indian postal addresses using `geopy` (OSM Nominatim).
3. **Interactive Civic Dashboard**: Features a dark-themed Leaflet.js map tracking incident pins color-coded by type. Popups exhibit address data, timestamps, verification statuses, and thumbnail crops.
4. **Summary Sidebar**: Showcases aggregate telemetry including today's reports count, categories list, and regional hotspot highlights.
5. **PDF Report Compilation**: Generates a downloadable ReportLab PDF containing executive summary tables, custom vector charts of incident density in Bengaluru, and incident lists.
6. **Robust Error Handling**: Standardizes all server and inference exceptions into clean `{error: string, code: string, suggestion: string}` responses.

---

## Technology Stack

- **ML Layer**: Python 3.11/3.14, Ultralytics YOLOv8, OpenCV, PyTorch.
- **Backend**: FastAPI, Uvicorn, SQLite database, SQLAlchemy ORM.
- **Frontend**: React 19 (TypeScript), Vite, Tailwind CSS, Leaflet.js / React Leaflet.
- **Reporting**: ReportLab PDF.
- **Containerization**: Docker, Docker-compose (Hugging Face Spaces compatible).

---

## API Documentation

### Public / Citizens Routes
* `POST /api/detect`: Process upload image, run YOLOv8, reverse-geocode coordinates, and save to DB.
* `GET  /api/detections`: Retrieve paginated history of reports. Supports filters: `damage_class`, `area`, `min_confidence`, `start_date`, `end_date`.
* `GET  /api/detections/{id}`: Fetch details for a specific case.
* `GET  /api/stats`: Retrieve summary aggregates for today's dashboard metrics.
* `GET  /api/report`: Compile and download a print-ready PDF summary of logs.

### Administrator / Verification Routes (Requires Bearer JWT)
* `POST   /api/auth/register`: Create a new citizen or administrator profile.
* `POST   /api/auth/login`: Authenticate credentials, returning access token.
* `GET    /api/auth/me`: Validate session token and check roles.
* `POST   /api/detections/{id}/verify`: Mark an incident as officially verified.
* `DELETE /api/detections/{id}`: Delete an entry and prune associated files.

---

## Installation & Setup

### Option 1: Docker-compose (One-Command Setup - Recommended)
1. Ensure Docker Desktop is installed and running.
2. Clone this repository and navigate to the project root.
3. Start the unified container system:
   ```bash
   docker-compose up --build
   ```
4. Access the unified dashboard at: `http://localhost:8000`.

### Option 2: Local Manual Setup (Development Mode)

#### 1. Backend Setup
1. Open a terminal and navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   py -m venv venv
   .\venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Copy the environment template:
   ```bash
   copy .env.example .env
   ```
5. Seed default accounts and 20 geolocated Bengaluru reports:
   ```bash
   python ../data/seed_data.py
   ```
6. Spin up the FastAPI server:
   ```bash
   python -m uvicorn main:app --reload --port 8000
   ```
   * *Swagger documentation: `http://localhost:8000/docs`*

#### 2. Frontend Setup
1. Open a new terminal and navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Install npm packages:
   ```bash
   npm install --legacy-peer-deps
   ```
3. Boot the Vite React development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to: `http://localhost:5173`.

---

## Default User Accounts (For Demo)
Use these credentials on the **Portal Sign In** page to test roles:
* **Citizen Account**: Username: `citizen` / Password: `citizenpassword`
* **Admin Account**: Username: `admin` / Password: `adminpassword` *(Allows you to delete reports and click "Verify" on the history logs page)*

---

## Fine-tuning YOLOv8 Model on Custom Data
If you have custom road damage datasets (e.g. RDD2020) formatted in the standard YOLO structure:
1. Create a `data.yaml` referencing paths to train, val, and class labels:
   ```yaml
   train: ../dataset/images/train
   val: ../dataset/images/val
   names:
     0: pothole
     1: crack
     2: waterlogging
     3: road_collapse
   ```
2. Run the fine-tuning training script:
   ```bash
   python backend/ml/train.py --data dataset/data.yaml --epochs 50 --batch 16 --imgsz 640 --base yolov8n.pt
   ```
3. Copy the compiled weights `road_damage_model/weights/best.pt` to `weights/yolov8_road_damage.pt` and update your backend `.env` variables.

---

## Hugging Face Spaces Deployment Template
This repository is configured to be uploaded directly to Hugging Face Spaces as a Docker template:
1. Create a new Space on Hugging Face.
2. Select **Docker** as the SDK and choose the blank/custom template.
3. Configure the Space's port to run on `8000` or set `EXPOSE 8000` in settings.
4. Git push the repository contents directly. Hugging Face will trigger the multi-stage build, compiling the React assets, setting up PyTorch, and serving the app from the container.
