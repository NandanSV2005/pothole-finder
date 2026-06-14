"""
Router for generating downloadable PDF reports of detections.
Uses ReportLab to compile tabular summaries, a cover page, and a field annexure with photos.
"""

import io
import os
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.graphics.shapes import Drawing, Rect, Circle, String as DrawingString, Line

from backend.database import get_db
from backend.models.models import Detection

logger = logging.getLogger("pothole_detector.reports")
router = APIRouter(prefix="/api/report", tags=["Reports"])

# Neighborhood definitions for group counting
BENGALURU_AREAS = [
    "Indiranagar", "Koramangala", "Jayanagar", "Whitefield", "HSR Layout", 
    "Malleshwaram", "Hebbal", "Yelahanka", "Marathahalli", "BTM Layout", 
    "Rajajinagar", "Sadashivanagar", "Electronic City", "Bellandur", "Banashankari",
    "Ulsoor", "Basavanagudi", "Domlur", "Kalyan Nagar", "Richmond Town"
]

def draw_schematic_map(detections: list) -> Drawing:
    """
    Draws a stylized map grid of Bengaluru and plots coordinates using ReportLab vector shapes.
    """
    d = Drawing(500, 160)
    
    # Map area background (slate color theme)
    d.add(Rect(0, 0, 500, 160, fillColor=colors.HexColor("#f1f5f9"), strokeColor=colors.HexColor("#cbd5e1"), strokeWidth=1.5))
    
    # Draw simple gridlines to simulate map grid
    for x in range(50, 500, 50):
        d.add(Line(x, 0, x, 160, strokeColor=colors.HexColor("#e2e8f0"), strokeWidth=1))
    for y in range(20, 160, 20):
        d.add(Line(0, y, 500, y, strokeColor=colors.HexColor("#e2e8f0"), strokeWidth=1))
        
    # Standard Bangalore Center (12.9716, 77.5946)
    min_lat, max_lat = 12.80, 13.15
    min_lng, max_lng = 77.40, 77.80
    
    # Draw center anchor icon
    center_x = 500 * (77.5946 - min_lng) / (max_lng - min_lng)
    center_y = 160 * (12.9716 - min_lat) / (max_lat - min_lat)
    d.add(Circle(center_x, center_y, 4, fillColor=colors.HexColor("#3b82f6"), strokeColor=colors.white, strokeWidth=1))
    d.add(DrawingString(center_x + 6, center_y - 3, "Majestic (Center)", fontSize=7, fillColor=colors.HexColor("#64748b")))

    # Plot detections
    plotted_count = 0
    for det in detections:
        if det.lat is None or det.lng is None:
            continue
            
        if not (min_lat <= det.lat <= max_lat) or not (min_lng <= det.lng <= max_lng):
            continue
            
        x = 500 * (det.lng - min_lng) / (max_lng - min_lng)
        y = 160 * (det.lat - min_lat) / (max_lat - min_lat)
        
        # Color match based on class
        color_map = {
            "pothole": colors.HexColor("#ef4444"),       # Red
            "crack": colors.HexColor("#f97316"),         # Orange
            "waterlogging": colors.HexColor("#eab308"),  # Yellow
            "road_collapse": colors.HexColor("#a855f7")  # Purple
        }
        marker_color = color_map.get(det.damage_class, colors.HexColor("#10b981"))
        
        # Draw plotted dot
        d.add(Circle(x, y, 4, fillColor=marker_color, strokeColor=colors.white, strokeWidth=0.5))
        plotted_count += 1
        
    # Draw Map Title/Legend inside the card
    d.add(Rect(5, 5, 180, 45, fillColor=colors.HexColor("#ffffffd0"), strokeColor=colors.HexColor("#cbd5e1"), strokeWidth=0.5))
    d.add(DrawingString(10, 38, "GEOSPATIAL DISTRIBUTION", fontSize=7, fillColor=colors.HexColor("#1e293b")))
    d.add(DrawingString(10, 30, f"Total Plotted Points: {plotted_count}", fontSize=6, fillColor=colors.HexColor("#475569")))
    
    # Legend color codes
    d.add(Circle(12, 12, 2.5, fillColor=colors.HexColor("#ef4444"), strokeColor=None))
    d.add(DrawingString(18, 10, "Pothole", fontSize=5.5, fillColor=colors.HexColor("#475569")))
    d.add(Circle(50, 12, 2.5, fillColor=colors.HexColor("#f97316"), strokeColor=None))
    d.add(DrawingString(56, 10, "Crack", fontSize=5.5, fillColor=colors.HexColor("#475569")))
    d.add(Circle(85, 12, 2.5, fillColor=colors.HexColor("#eab308"), strokeColor=None))
    d.add(DrawingString(91, 10, "Waterlog", fontSize=5.5, fillColor=colors.HexColor("#475569")))
    d.add(Circle(125, 12, 2.5, fillColor=colors.HexColor("#a855f7"), strokeColor=None))
    d.add(DrawingString(131, 10, "Collapse", fontSize=5.5, fillColor=colors.HexColor("#475569")))

    return d

@router.get("")
def generate_pdf_report(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Generates a downloadable PDF report of all road damage detections within a date range.
    Includes Cover Page, Executive Summary, Top 10 worst roads, Detailed logs, and Photo Annexure.
    """
    query = db.query(Detection)
    
    start_dt = None
    end_dt = None
    
    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date)
            query = query.filter(Detection.timestamp >= start_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD.")
            
    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date)
            query = query.filter(Detection.timestamp <= end_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD.")
            
    detections = query.order_by(Detection.timestamp.desc()).all()
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, 
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    cover_title_style = ParagraphStyle(
        name="CoverTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=28,
        textColor=colors.HexColor("#0f172a"),
        alignment=1, # Center
        spaceAfter=15
    )
    
    cover_subtitle_style = ParagraphStyle(
        name="CoverSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#475569"),
        alignment=1,
        spaceAfter=30
    )

    title_style = ParagraphStyle(
        name="ReportTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#1e3a8a"),
        spaceAfter=10
    )
    
    h2_style = ParagraphStyle(
        name="SectionHeader",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=15,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        name="ReportBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#334155")
    )
    
    bold_body_style = ParagraphStyle(
        name="ReportBodyBold",
        parent=body_style,
        fontName="Helvetica-Bold"
    )

    header_cell_style = ParagraphStyle(
        name="HeaderCell",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        textColor=colors.white
    )

    story = []
    
    # ==================== 1. COVER PAGE ====================
    story.append(Spacer(1, 100))
    # Decorative Shield / Seal placeholder
    seal_drawing = Drawing(540, 60)
    seal_drawing.add(Rect(245, 0, 50, 60, fillColor=colors.HexColor("#1e3a8a"), strokeColor=None))
    seal_drawing.add(Circle(270, 30, 20, fillColor=colors.HexColor("#f59e0b"), strokeColor=colors.white, strokeWidth=1))
    seal_drawing.add(DrawingString(264, 25, "RS", fontSize=14, fillColor=colors.white))
    story.append(seal_drawing)
    story.append(Spacer(1, 20))
    
    story.append(Paragraph("BENGALURU ROAD QUALITY & INCIDENT TELEMETRY REPORT", cover_title_style))
    story.append(Paragraph("Automated Incident Mapping and Infrastructure Damage Assessment Log", cover_subtitle_style))
    story.append(Spacer(1, 50))
    
    # Metadata Block Table
    date_str = datetime.now().strftime("%B %d, %Y")
    metadata_data = [
        [Paragraph("<b>Prepared For:</b>", body_style), Paragraph("Bruhat Bengaluru Mahanagara Palike (BBMP)", body_style)],
        [Paragraph("<b>Recipient Office:</b>", body_style), Paragraph("Commissioner of Road Infrastructure, Bengaluru", body_style)],
        [Paragraph("<b>Compiled By:</b>", body_style), Paragraph("RoadSense Citizen Network & YOLOv8 Analytics", body_style)],
        [Paragraph("<b>Date of Compilation:</b>", body_style), Paragraph(date_str, body_style)],
        [Paragraph("<b>Database Scope:</b>", body_style), Paragraph(f"{start_date or 'Earliest Log'} to {end_date or 'Present (Real-time)'}", body_style)]
    ]
    metadata_table = Table(metadata_data, colWidths=[150, 250])
    metadata_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
    ]))
    story.append(metadata_table)
    
    story.append(Spacer(1, 150))
    story.append(Paragraph("<font color='#64748b'>* Confidentially Compiled for BBMP Civic Maintenance Action</font>", body_style))
    story.append(PageBreak())
    
    # ==================== 2. EXECUTIVE SUMMARY & TELEMETRY ====================
    story.append(Paragraph("Executive Summary & Telemetry", title_style))
    story.append(Paragraph("This document compiles verified and pending citizen-reported road damage logs across Bengaluru. Measurements utilize real-time YOLOv8 object identification combined with bounding-box size metrics and local monocular shading heuristics to triage road incident severity.", body_style))
    story.append(Spacer(1, 10))
    
    # Calculate counts
    total = len(detections)
    potholes = sum(1 for d in detections if d.damage_class == "pothole")
    cracks = sum(1 for d in detections if d.damage_class == "crack")
    waterlogging = sum(1 for d in detections if d.damage_class == "waterlogging")
    collapses = sum(1 for d in detections if d.damage_class == "road_collapse")
    
    minor = sum(1 for d in detections if d.severity == "minor")
    moderate = sum(1 for d in detections if d.severity == "moderate")
    critical = sum(1 for d in detections if d.severity == "critical")
    
    verified = sum(1 for d in detections if d.is_verified)
    
    summary_data = [
        [
            Paragraph("<b>Total Road Anomalies:</b>", body_style), Paragraph(str(total), bold_body_style),
            Paragraph("<b>Minor Damage:</b>", body_style), Paragraph(f"<font color='#4caf50'><b>{minor}</b></font>", body_style)
        ],
        [
            Paragraph("<b>Potholes Detected:</b>", body_style), Paragraph(str(potholes), body_style),
            Paragraph("<b>Moderate Damage:</b>", body_style), Paragraph(f"<font color='#ff9800'><b>{moderate}</b></font>", body_style)
        ],
        [
            Paragraph("<b>Cracks / Fractures:</b>", body_style), Paragraph(str(cracks), body_style),
            Paragraph("<b>Critical Issues:</b>", body_style), Paragraph(f"<font color='#f44336'><b>{critical}</b></font>", body_style)
        ],
        [
            Paragraph("<b>Waterlogging Areas:</b>", body_style), Paragraph(str(waterlogging), body_style),
            Paragraph("<b>Official Verification Rate:</b>", body_style), Paragraph(f"{verified} of {total} ({int(verified/total*100) if total > 0 else 0}%)", body_style)
        ],
        [
            Paragraph("<b>Road Collapse Areas:</b>", body_style), Paragraph(str(collapses), body_style),
            Paragraph("", body_style), Paragraph("", body_style)
        ]
    ]
    
    summary_table = Table(summary_data, colWidths=[130, 140, 130, 140])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 10))
    
    # Map
    story.append(Paragraph("Bengaluru Incident Density Map", h2_style))
    story.append(draw_schematic_map(detections))
    story.append(Spacer(1, 15))
    
    # ==================== 3. TOP 10 WORST ROADS BY INCIDENT COUNT ====================
    story.append(Paragraph("Top 10 Worst Areas by Damage Intensity", h2_style))
    
    # Group by area
    area_incidents: Dict[str, Dict[str, int]] = {}
    for det in detections:
        # Match address to neighborhood
        matched_area = "Other Areas"
        if det.address:
            for area in BENGALURU_AREAS:
                if area.lower() in det.address.lower():
                    matched_area = area
                    break
        
        if matched_area not in area_incidents:
            area_incidents[matched_area] = {"total": 0, "critical": 0, "moderate": 0, "minor": 0}
            
        area_incidents[matched_area]["total"] += 1
        area_incidents[matched_area][det.severity] += 1
        
    sorted_areas = sorted(area_incidents.items(), key=lambda x: x[1]["total"], reverse=True)[:10]
    
    worst_headers = ["Rank", "Neighborhood / Area", "Total Alerts", "Minor", "Moderate", "Critical", "Status Priority"]
    worst_rows = [[Paragraph(h, header_cell_style) for h in worst_headers]]
    
    for rank, (area_name, stats) in enumerate(sorted_areas, 1):
        priority = "LOW"
        priority_color = "#4caf50"
        if stats["critical"] > 0:
            priority = "IMMEDIATE ACTION"
            priority_color = "#f44336"
        elif stats["moderate"] > 0:
            priority = "SCHEDULE MAINTENANCE"
            priority_color = "#ff9800"
            
        worst_rows.append([
            Paragraph(str(rank), body_style),
            Paragraph(area_name, bold_body_style),
            Paragraph(str(stats["total"]), body_style),
            Paragraph(str(stats["minor"]), body_style),
            Paragraph(str(stats["moderate"]), body_style),
            Paragraph(str(stats["critical"]), body_style),
            Paragraph(f"<font color='{priority_color}'><b>{priority}</b></font>", body_style)
        ])
        
    worst_table = Table(worst_rows, colWidths=[35, 150, 70, 45, 55, 55, 130])
    worst_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#1e3a8a")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#f8fafc")]),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
    ]))
    story.append(worst_table)
    
    story.append(PageBreak())
    
    # ==================== 4. DETAILED LOGS TABLE (TOP 15 FOR PRINT SIZE) ====================
    story.append(Paragraph("Detailed Damage History Log (Top 15 Cases)", h2_style))
    
    table_headers = ["ID", "Timestamp", "Damage Class", "Confidence", "Severity", "Address"]
    table_rows = [[Paragraph(h, header_cell_style) for h in table_headers]]
    
    display_detections = detections[:15]
    for det in display_detections:
        time_str = det.timestamp.strftime("%Y-%m-%d %H:%M")
        addr_trimmed = det.address[:38] + "..." if det.address and len(det.address) > 38 else (det.address or "unknown")
        
        # Color coding severity in table
        sev_color = "#4caf50"
        if det.severity == "critical":
            sev_color = "#f44336"
        elif det.severity == "moderate":
            sev_color = "#ff9800"
            
        table_rows.append([
            Paragraph(str(det.id), body_style),
            Paragraph(time_str, body_style),
            Paragraph(det.damage_class.replace("_", " ").title(), body_style),
            Paragraph(f"{det.confidence*100:.0f}%", body_style),
            Paragraph(f"<font color='{sev_color}'><b>{det.severity.upper()}</b></font>", body_style),
            Paragraph(addr_trimmed, body_style)
        ])
        
    history_table = Table(table_rows, colWidths=[30, 85, 90, 60, 75, 200])
    history_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#1e3a8a")),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#f8fafc")]),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
    ]))
    story.append(history_table)
    story.append(Spacer(1, 20))
    
    # ==================== 5. PHOTO ANNEXURE ====================
    # Show real annotated photos of the top 3 critical severity logs
    critical_detections_with_images = [d for d in detections if d.severity == "critical" and d.image_path][:3]
    
    if len(critical_detections_with_images) > 0:
        story.append(PageBreak())
        story.append(Paragraph("Field Photo Annexure: Critical Incidents", title_style))
        story.append(Paragraph("The following items highlight critical roadway structural failures requiring immediate repair. The frames below show the automated YOLO bounding boxes outlining the location and extent of the collapses or potholes.", body_style))
        story.append(Spacer(1, 15))
        
        upload_dir = Path("backend/data/uploads")
        for det in critical_detections_with_images:
            filename = det.image_path.split("/")[-1]
            img_path = upload_dir / filename
            
            if img_path.exists():
                # ReportLab image flowables require physical paths
                try:
                    incident_info = [
                        Paragraph(f"<b>Incident ID:</b> {det.id} | <b>Class:</b> {det.damage_class.replace('_', ' ').title()} | <b>Confidence:</b> {det.confidence*100:.0f}%", body_style),
                        Paragraph(f"<b>Reported Time:</b> {det.timestamp.strftime('%Y-%m-%d %H:%M:%S')} | <b>Priority:</b> CRITICAL", body_style),
                        Paragraph(f"<b>Location Address:</b> {det.address or 'location unknown'}", body_style),
                        Spacer(1, 5),
                        Image(str(img_path), width=320, height=240),
                        Spacer(1, 15)
                    ]
                    # Keep entire incident segment together so it doesn't split across pages
                    story.append(KeepTogether(incident_info))
                except Exception as img_err:
                    logger.error(f"Failed to load image in reportlab: {img_err}")
                    
    # Build document
    doc.build(story)
    
    buffer.seek(0)
    range_filename_str = f"road_damage_report_{datetime.now().strftime('%Y%m%d')}.pdf"
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={range_filename_str}"}
    )
