---
title: RoadSense
emoji: 🛣️
colorFrom: blue
colorTo: red
sdk: docker
pinned: false
---

# 🚧 PotholeAI — Smart Road Damage Detection & Civic Intelligence Platform

> Real-time road damage detection, severity triage, and civic reporting — powered by YOLOv8 and built for Indian roads.

<!-- DEMO GIF PLACEHOLDER -->
<!-- Record a 30-45 second screen capture of: upload an image → detection runs → annotated result appears → marker shows on map → heatmap updates -->
<!-- Use LICEcap (Windows/Mac) or Peek (Linux) to record. Drop the .gif file into /assets/demo.gif and replace this comment with: ![Demo](assets/demo.gif) -->

**Live Demo:** [Hugging Face Spaces](https://huggingface.co/spaces/NandanSV/RoadSense) | **Video Walkthrough:** [YouTube/Loom link if recorded]

---

## The Problem

According to the Ministry of Road Transport and Highways (MoRTH) and the National Crime Records Bureau (NCRB), bad road conditions and potholes contribute to thousands of traffic accidents and over 4,700 deaths annually across India. In rapidly growing urban centers like Bengaluru, current road quality inspections are slow, subjective, and reliant on manual reporting processes that fail to capture geographic density or severity. PotholeAI resolves this civic bottleneck by replacing manual, slow-response reporting with an automated, computer vision-driven pipeline that maps and triages road anomalies instantly.

---

## What This Does

PotholeAI bridges the gap between active citizen reporting and municipal road infrastructure maintenance. When a citizen uploads an image of road damage or streams a dashcam video route, the system runs it through a customized YOLOv8 object detection model to identify road anomalies across four distinct classes: *potholes*, *cracks*, *waterlogging*, and *road collapses*. Simultaneously, a monocular depth-cue engine evaluates the severity of the damage (Minor, Moderate, or Critical) by measuring relative bounding box areas and local shading/contrast variations. The browser's Geolocation API captures coordinates, which the FastAPI backend reverse-geocodes into detailed Indian postal addresses. Every incident is stored in a SQLite database and instantly plotted on an interactive Leaflet dashboard equipped with regional hotspots, live stats, and a density heatmap, enabling municipal administrators to filter data, verify alerts, and generate formal ReportLab PDF action summaries.

---

## Screenshots

### Dashboard — Live Heatmap
<!-- Screenshot: full dashboard view with map, heatmap layer on, sidebar stats visible -->
<!-- Save as assets/screenshot-dashboard.png -->
![Dashboard](assets/screenshot-dashboard.png)

### Detection Result
<!-- Screenshot: upload page after a detection runs — annotated image with bounding boxes, severity badge, confidence score -->
<!-- Save as assets/screenshot-detection.png -->
![Detection Result](assets/screenshot-detection.png)

### Civic Report PDF
<!-- Screenshot: the generated PDF open in browser — cover page or summary page -->
<!-- Save as assets/screenshot-report.png -->
![Report](assets/screenshot-report.png)

### Mobile PWA View
<!-- Screenshot: the app on a mobile browser or Android home screen -->
<!-- Save as assets/screenshot-mobile.png -->
![Mobile PWA](assets/screenshot-mobile.png)

> **Note to developer:** Take these screenshots after the app is running locally with seed data loaded. Four screenshots is the minimum. Use a real browser at 1280×800 for desktop shots.

---

## Features

### Core Detection Engine
- **YOLOv8 Inference**: Detects, localizes, and classifies road damage classes with high-performance bounding box annotations.
- **Severity Scoring Engine**: Categorizes incidents as *Minor*, *Moderate*, or *Critical* using a hybrid heuristic that combines bounding box scale ratios and monocular depth cues (shading and contrast parameters in OpenCV).
- **Dashcam Video Batch Processing**: Decodes uploaded MP4/AVI videos, samples frames at custom intervals, interpolates GPS coordinates along the driving route, and returns a timestamped event timeline.
- **4 Custom Damage Classes**: Full support for `pothole`, `crack`, `waterlogging`, and `road_collapse`.

### Civic Intelligence Dashboard
- **Interactive Leaflet.js Map**: Renders color-coded incident markers based on damage severity (Green: Minor, Orange: Moderate, Red: Critical).
- **Density Heatmap**: Implements a `Leaflet.heat` layer showing incident concentration overlays across Bengaluru.
- **Live Sidebar Telemetry**: Displays aggregates for today's reports, total historical cases, damage type breakdowns, and top hotspot neighborhoods.
- **Advanced Filtering Logs**: A tabular ledger allowing administrators to filter incidents by dates, severity levels, classes, specific areas, and confidence thresholds.

### Reporting & Tracking
- **Municipality-Ready PDF Report**: Generates official ReportLab executive briefs including cover pages, summary statistics tables, schematic vector maps, and high-priority photo annexures.
- **Before/After Change Detection**: Employs a custom Structural Similarity Index (SSIM) algorithm to compare pre- and post-repair images, auto-triaging roads as *Repaired* or *Worsened*.
- **Human Feedback Loop**: Allows users and managers to "Flag as incorrect" to calculate model false-positive rates, creating a loop for active retraining.
- **Incident Lifecycle Tracking**: Renders dynamic statuses (*Active*, *Worsened*, *Repaired*) over time.

### Citizen Access
- **Progressive Web App (PWA)**: Desktop/mobile installable via manifest configs and custom service workers, enabling offline capability and citizen access.
- **GPS Auto-Capture**: Integrates HTML5 browser Geolocation APIs to tag GPS coordinates automatically on camera captures.
- **Social Sharing**: Allows one-tap sharing of annotated telemetry reports to WhatsApp and email.
- **Direct Mail Link**: Pre-populates mail configurations using a `mailto` link targeting local municipal engineering offices with text logs.

---

## Architecture

```
+-------------------------------------------------------------------------+
|                          POTHOLEAI CIVIC TECH                           |
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

## Technology Stack

- **ML Layer**: Python 3.11, Ultralytics YOLOv8, OpenCV, PyTorch.
- **Backend Service**: FastAPI, SQLAlchemy ORM, Uvicorn, SQLite Database, Geopy (OpenStreetMap Nominatim API).
- **Frontend App**: React 19 (TypeScript), Vite, Tailwind CSS, Leaflet.js & React Leaflet.
- **PDF Engine**: ReportLab.
- **PWA Configuration**: Custom service worker, web manifest configuration.
- **Containerization**: Docker, Docker-compose (compatible with Hugging Face Spaces and Render).

---

## API Documentation

### Public / Citizens Routes
* `POST /api/detect` - Process upload image, run YOLOv8, reverse-geocode coordinates, and save to DB.
  * Form Data: `file: UploadFile`, `lat: float` (optional), `lng: float` (optional).
* `POST /api/detections/video` - Process dashcam video frame-by-frame, interpolate route coordinates, and log incidents.
  * Form Data: `file: UploadFile`, `frame_interval: int` (default `10`), `lat: float` (optional), `lng: float` (optional).
* `POST /api/detections/compare` - Runs SSIM and YOLOv8 on before/after photos at the same coordinates.
  * Form Data: `image_before: UploadFile`, `image_after: UploadFile`.
* `GET /api/detections` - Retrieves a paginated history of reports.
  * Query parameters: `page`, `limit`, `damage_class`, `area`, `min_confidence`, `start_date`, `end_date`.
* `GET /api/detections/{id}` - Fetch details for a specific case.
* `POST /api/detections/{id}/flag` - Flag a detection as incorrect (correction loop).
* `GET /api/stats` - Retrieve summary dashboard telemetry.
* `GET /api/stats/analytics` - Fetch aggregate confidence charts, FP rates, and 30-day precision trends.
* `GET /api/report` - Compiles and streams a downloadable PDF quality report.
  * Query parameters: `start_date`, `end_date` (optional).

### Administrator / Verification Routes (Requires Bearer JWT)
* `POST /api/auth/register` - Register a new citizen or administrator.
* `POST /api/auth/login` - Authenticate credentials and return JWT access token.
* `GET /api/auth/me` - Validate session token and check roles.
* `POST /api/detections/{id}/verify` - Mark an incident as officially verified.
* `DELETE /api/detections/{id}` - Delete an entry and prune associated files.

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
1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   py -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Copy the environment variables:
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
   * *Swagger interactive documentation: `http://localhost:8000/docs`*

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
