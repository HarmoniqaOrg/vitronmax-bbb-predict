"""
PDF report generation endpoints.
"""

import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
import io
from typing import Dict, Any

from reportlab.lib import colors  # type: ignore[import-untyped]
from reportlab.lib.pagesizes import A4  # type: ignore[import-untyped]
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle  # type: ignore[import-untyped]
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle  # type: ignore[import-untyped]

from app.models.schemas import PredictionRequest
from app.ml.predictor import BBBPredictor
from app.core.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter()


def get_predictor() -> BBBPredictor:
    """Dependency to get ML predictor instance."""
    from app.main import app

    # Ensure predictor is of the correct type for Mypy
    assert isinstance(app.state.predictor, BBBPredictor)
    return app.state.predictor


def generate_molecule_report(
    smiles: str, molecule_name: str, prediction_data: Dict[str, Any]
) -> bytes:
    """Generate PDF report for a molecule."""

    # Create PDF buffer
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)

    # Get styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "CustomTitle",
        parent=styles["Heading1"],
        fontSize=24,
        textColor=colors.HexColor("#2563eb"),
        spaceAfter=30,
    )

    # Story elements
    story = []

    # Title
    story.append(Paragraph("VitronMax BBB Permeability Report", title_style))
    story.append(Spacer(1, 20))

    # Molecule information
    story.append(Paragraph("Molecule Information", styles["Heading2"]))
    mol_data = [
        ["Parameter", "Value"],
        ["SMILES", smiles],
        ["Molecule Name", molecule_name or "N/A"],
        ["Analysis Date", datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")],
    ]

    mol_table = Table(mol_data)
    mol_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 12),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
                ("BACKGROUND", (0, 1), (-1, -1), colors.beige),
                ("GRID", (0, 0), (-1, -1), 1, colors.black),
            ]
        )
    )

    story.append(mol_table)
    story.append(Spacer(1, 20))

    # Prediction results
    story.append(Paragraph("BBB Permeability Prediction", styles["Heading2"]))

    pred_data = [
        ["Metric", "Value"],
        ["BBB Probability", f"{prediction_data['bbb_probability']:.3f}"],
        [
            "Prediction Class",
            prediction_data["prediction_class"].replace("_", " ").title(),
        ],
        ["Confidence Score", f"{prediction_data['confidence_score']:.3f}"],
        ["Processing Time", f"{prediction_data['processing_time_ms']:.2f} ms"],
    ]

    pred_table = Table(pred_data)
    pred_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 12),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
                ("BACKGROUND", (0, 1), (-1, -1), colors.lightblue),
                ("GRID", (0, 0), (-1, -1), 1, colors.black),
            ]
        )
    )

    story.append(pred_table)
    story.append(Spacer(1, 20))

    # Interpretation
    story.append(Paragraph("Interpretation", styles["Heading2"]))

    if prediction_data["bbb_probability"] >= 0.7:
        interpretation = "High probability of crossing the blood-brain barrier."
    elif prediction_data["bbb_probability"] >= 0.3:
        interpretation = "Moderate probability of crossing the blood-brain barrier."
    else:
        interpretation = "Low probability of crossing the blood-brain barrier."

    story.append(Paragraph(interpretation, styles["Normal"]))
    story.append(Spacer(1, 10))

    confidence_text = (
        f"Confidence in this prediction: {prediction_data['confidence_score']:.1%}"
    )
    story.append(Paragraph(confidence_text, styles["Normal"]))
    story.append(Spacer(1, 20))

    # Methodology
    story.append(Paragraph("Methodology", styles["Heading2"]))
    methodology_text = """
    This prediction was generated using a Random Forest classifier trained on molecular 
    fingerprint features. The model uses Morgan fingerprints (radius=2, 2048 bits) to 
    capture molecular structure information and predict blood-brain barrier permeability.
    """
    story.append(Paragraph(methodology_text, styles["Normal"]))

    # Disclaimer
    story.append(Spacer(1, 30))
    disclaimer_style = ParagraphStyle(
        "Disclaimer",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.grey,
        leftIndent=20,
        rightIndent=20,
    )

    disclaimer_text = """
    Disclaimer: This prediction is for research purposes only and should not be used 
    as the sole basis for drug development decisions. Experimental validation is 
    recommended for critical applications.
    """
    story.append(Paragraph(disclaimer_text, disclaimer_style))

    # Build PDF
    doc.build(story)

    # Get PDF bytes
    pdf_bytes = buffer.getvalue()
    buffer.close()

    return pdf_bytes


@router.get("/report/{molecule_id}")
async def generate_report_by_id(molecule_id: str) -> StreamingResponse:
    """Generate PDF report for a previously analyzed molecule."""
    db = get_db()

    try:
        # Get molecule data from database
        response = db.table("molecules").select("*").eq("id", molecule_id).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Molecule not found")

        mol_data = response.data[0]

        prediction_data = {
            "bbb_probability": mol_data["bbb_probability"],
            "prediction_class": mol_data["prediction_class"],
            "confidence_score": mol_data["confidence_score"],
            "processing_time_ms": 0.0,  # Historical data
        }

        # Generate PDF report
        pdf_bytes = generate_molecule_report(
            mol_data["smiles"], mol_data.get("molecule_name", ""), prediction_data
        )

        # Return as streaming response
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=report_{molecule_id}.pdf"
            },
        )

    except Exception as e:
        logger.error(f"Report generation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate report")


@router.post("/report")
async def generate_report_from_smiles(
    request: PredictionRequest, predictor: BBBPredictor = Depends(get_predictor)
) -> StreamingResponse:
    """Generate PDF report for a given SMILES string."""

    try:
        # Make prediction
        probability, pred_class, confidence, fingerprint = predictor.predict_single(
            request.smiles
        )

        prediction_data = {
            "bbb_probability": probability,
            "prediction_class": pred_class,
            "confidence_score": confidence,
            "processing_time_ms": 0.0,
        }

        # Generate PDF report
        pdf_bytes = generate_molecule_report(
            request.smiles, request.molecule_name or "", prediction_data
        )

        # Return as streaming response
        filename = f"bbb_report_{request.molecule_name or 'molecule'}.pdf"
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    except Exception as e:
        logger.error(f"Report generation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate report")
