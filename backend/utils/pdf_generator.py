"""
PDF certificate generator using ReportLab.
Creates professional certificates with QR codes for verification.
"""

import os
import io
from datetime import datetime

import qrcode
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

from config import settings
from utils.helpers import ensure_directory


def generate_certificate_pdf(
    certificate_uid: str,
    user_full_name: str,
    course_title: str,
    instructor_name: str,
    completion_date: datetime,
    output_dir: str = None,
) -> str:
    """
    Generate a professional PDF certificate.
    Returns the file path of the generated PDF.
    """
    if output_dir is None:
        output_dir = os.path.join(settings.UPLOAD_DIR, "certificates")
    ensure_directory(output_dir)

    filename = f"certificate_{certificate_uid}.pdf"
    filepath = os.path.join(output_dir, filename)

    width, height = landscape(A4)
    pdf = canvas.Canvas(filepath, pagesize=landscape(A4))

    # Background
    pdf.setFillColor(HexColor("#1A1A1A"))
    pdf.rect(0, 0, width, height, fill=True)

    # Border
    pdf.setStrokeColor(HexColor("#FFA116"))
    pdf.setLineWidth(3)
    pdf.rect(30, 30, width - 60, height - 60, fill=False)
    pdf.setLineWidth(1)
    pdf.rect(40, 40, width - 80, height - 80, fill=False)

    # Header
    pdf.setFillColor(HexColor("#FFA116"))
    pdf.setFont("Helvetica-Bold", 36)
    pdf.drawCentredString(width / 2, height - 100, "CERTIFICATE OF COMPLETION")

    # Decorative line
    pdf.setStrokeColor(HexColor("#FFA116"))
    pdf.setLineWidth(2)
    pdf.line(width / 2 - 150, height - 115, width / 2 + 150, height - 115)

    # Subtitle
    pdf.setFillColor(HexColor("#BDBDBD"))
    pdf.setFont("Helvetica", 14)
    pdf.drawCentredString(width / 2, height - 150, "This is to certify that")

    # Student name
    pdf.setFillColor(HexColor("#F5F5F5"))
    pdf.setFont("Helvetica-Bold", 28)
    pdf.drawCentredString(width / 2, height - 190, user_full_name)

    # Course text
    pdf.setFillColor(HexColor("#BDBDBD"))
    pdf.setFont("Helvetica", 14)
    pdf.drawCentredString(width / 2, height - 230, "has successfully completed the course")

    # Course title
    pdf.setFillColor(HexColor("#FFA116"))
    pdf.setFont("Helvetica-Bold", 22)
    pdf.drawCentredString(width / 2, height - 265, course_title)

    # Instructor
    pdf.setFillColor(HexColor("#BDBDBD"))
    pdf.setFont("Helvetica", 12)
    pdf.drawCentredString(width / 2, height - 305, f"Instructor: {instructor_name}")

    # Date
    formatted_date = completion_date.strftime("%B %d, %Y")
    pdf.drawCentredString(width / 2, height - 330, f"Completed on: {formatted_date}")

    # Certificate ID
    pdf.setFillColor(HexColor("#666666"))
    pdf.setFont("Helvetica", 9)
    pdf.drawCentredString(width / 2, 60, f"Certificate ID: {certificate_uid}")

    # QR Code
    verification_url = f"{settings.FRONTEND_URL}/verify/{certificate_uid}"
    qr = qrcode.make(verification_url)
    qr_buffer = io.BytesIO()
    qr.save(qr_buffer, format="PNG")
    qr_buffer.seek(0)
    qr_image = ImageReader(qr_buffer)
    pdf.drawImage(qr_image, width - 130, 50, width=70, height=70)

    pdf.setFillColor(HexColor("#666666"))
    pdf.setFont("Helvetica", 7)
    pdf.drawCentredString(width - 95, 43, "Scan to verify")

    pdf.save()
    return filepath
