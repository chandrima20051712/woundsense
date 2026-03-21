"""report.py — POST /api/v1/report — generate a PDF wound report."""

import io
import base64
from datetime import datetime

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

router = APIRouter()

WIDTH, HEIGHT = A4


class ReportRequest(BaseModel):
    wound_area_cm2: float
    wound_perimeter_cm: float
    wound_dimensions_cm: Optional[List[float]] = None
    precision_mm: float
    coin_detected: bool
    time_scores: Dict[str, float]
    tissue_ratios: Dict[str, int]
    wound_condition: str
    recommendations: List[str]
    masked_image: str  # base64 JPEG
    inference_ms: float
    model_mode: str


def _time_color(score: float):
    if score < 0.3:
        return colors.HexColor("#22c55e")
    if score < 0.6:
        return colors.HexColor("#eab308")
    return colors.HexColor("#ef4444")


def _condition_color(condition: str):
    if "Critical" in condition:
        return colors.HexColor("#ef4444")
    if "Moderate" in condition:
        return colors.HexColor("#eab308")
    return colors.HexColor("#22c55e")


def _build_pdf(data: ReportRequest) -> io.BytesIO:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=20*mm, bottomMargin=15*mm,
                            leftMargin=15*mm, rightMargin=15*mm)

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle("Title2", parent=styles["Title"], fontSize=20,
                              textColor=colors.HexColor("#1a3c5e"), spaceAfter=4))
    styles.add(ParagraphStyle("Subtitle", parent=styles["Normal"], fontSize=10,
                              textColor=colors.HexColor("#64748b"), spaceAfter=12))
    styles.add(ParagraphStyle("SectionHead", parent=styles["Heading2"], fontSize=13,
                              textColor=colors.HexColor("#1a3c5e"), spaceBefore=14, spaceAfter=6))
    styles.add(ParagraphStyle("RecText", parent=styles["Normal"], fontSize=10,
                              leading=14, spaceBefore=2, spaceAfter=2))

    elements = []

    # Header
    elements.append(Paragraph("WoundSense Analysis Report", styles["Title2"]))
    now = datetime.now().strftime("%d %B %Y, %I:%M %p")
    elements.append(Paragraph(f"Generated: {now}", styles["Subtitle"]))

    # Condition
    cond_color = _condition_color(data.wound_condition)
    elements.append(Paragraph(
        f'<font color="{cond_color.hexval()}">{data.wound_condition}</font>',
        ParagraphStyle("Condition", parent=styles["Normal"], fontSize=14, fontName="Helvetica-Bold", spaceAfter=10)
    ))

    # Wound image
    if data.masked_image:
        try:
            img_bytes = base64.b64decode(data.masked_image)
            img_buf = io.BytesIO(img_bytes)
            img = RLImage(img_buf, width=160*mm, height=100*mm, kind="proportional")
            elements.append(img)
            elements.append(Spacer(1, 8*mm))
        except Exception:
            pass

    # Measurements table
    elements.append(Paragraph("Wound Measurements", styles["SectionHead"]))
    dims = f"{data.wound_dimensions_cm[0]} x {data.wound_dimensions_cm[1]} cm" if data.wound_dimensions_cm else "N/A"
    coin_status = "Detected (calibrated)" if data.coin_detected else "Not detected (estimated)"
    mdata = [
        ["Area", f"{data.wound_area_cm2} cm\u00b2"],
        ["Perimeter", f"{data.wound_perimeter_cm} cm"],
        ["Dimensions", dims],
        ["Precision", f"\u00b1{data.precision_mm} mm"],
        ["Coin Reference", coin_status],
    ]
    t = Table(mdata, colWidths=[60*mm, 100*mm])
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#1a3c5e")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, colors.HexColor("#e2e8f0")),
    ]))
    elements.append(t)

    # TIME Framework
    elements.append(Paragraph("TIME Framework Assessment", styles["SectionHead"]))
    time_labels = {"T": "Tissue", "I": "Infection", "M": "Moisture", "E": "Edge"}
    time_data = [["Parameter", "Score", "Status"]]
    for key in ["T", "I", "M", "E"]:
        val = data.time_scores.get(key, 0)
        pct = f"{int(val * 100)}%"
        status = "Good" if val < 0.3 else "Monitor" if val < 0.6 else "Critical"
        time_data.append([f"{key} - {time_labels[key]}", pct, status])

    tt = Table(time_data, colWidths=[60*mm, 40*mm, 60*mm])
    tt.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a3c5e")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("ALIGN", (1, 0), (1, -1), "CENTER"),
    ]))
    # Color the status cells
    for i, key in enumerate(["T", "I", "M", "E"], start=1):
        val = data.time_scores.get(key, 0)
        tt.setStyle(TableStyle([
            ("TEXTCOLOR", (2, i), (2, i), _time_color(val)),
            ("FONTNAME", (2, i), (2, i), "Helvetica-Bold"),
        ]))
    elements.append(tt)

    # Tissue Composition
    elements.append(Paragraph("Tissue Composition", styles["SectionHead"]))
    tissue_data = [["Tissue Type", "Percentage"]]
    tissue_colors = {
        "granulation": "#ef4444", "slough": "#eab308",
        "necrotic": "#1e293b", "epithelial": "#22d3ee",
    }
    for tissue, pct in data.tissue_ratios.items():
        if pct > 0:
            tissue_data.append([tissue.capitalize(), f"{pct}%"])
    tst = Table(tissue_data, colWidths=[80*mm, 80*mm])
    tst.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a3c5e")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
    ]))
    elements.append(tst)

    # Recommendations
    elements.append(Paragraph("Clinical Recommendations", styles["SectionHead"]))
    for rec in data.recommendations:
        clean = rec.replace("✅", "[OK]").replace("⚠️", "[!]").replace("🔴", "[!!]")
        elements.append(Paragraph(f"\u2022  {clean}", styles["RecText"]))

    # Footer
    elements.append(Spacer(1, 12*mm))
    elements.append(Paragraph(
        f"Inference: {data.inference_ms}ms | Mode: {data.model_mode} | WoundSense AI v1.0",
        ParagraphStyle("Footer", parent=styles["Normal"], fontSize=8,
                       textColor=colors.HexColor("#cbd5e1"), alignment=1)
    ))

    doc.build(elements)
    buf.seek(0)
    return buf


@router.post("/report", summary="Generate PDF wound report")
async def generate_report(data: ReportRequest):
    try:
        pdf_buf = _build_pdf(data)
    except Exception as e:
        raise HTTPException(500, f"PDF generation failed: {e}")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"WoundSense_Report_{timestamp}.pdf"

    return StreamingResponse(
        pdf_buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
