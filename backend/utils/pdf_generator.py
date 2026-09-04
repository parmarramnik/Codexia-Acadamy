"""
PDF certificate generator using ReportLab.
Creates prestigious, executive-grade verified certificates with QR authentication and official Codexia branding.
"""

import os
import io
from datetime import datetime

import qrcode
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

from config import settings
from utils.helpers import ensure_directory


def _wrap_course_title(course_title: str, max_chars: int = 52) -> list:
    """Intelligently wraps long course titles at colons or word boundaries."""
    if len(course_title) <= max_chars:
        return [course_title]
    if ":" in course_title:
        parts = course_title.split(":", 1)
        return [parts[0].strip() + ":", parts[1].strip()]
    
    words = course_title.split()
    lines = []
    current = []
    current_len = 0
    for w in words:
        if current_len + len(w) + 1 > max_chars and current:
            lines.append(" ".join(current))
            current = [w]
            current_len = len(w)
        else:
            current.append(w)
            current_len += len(w) + 1
    if current:
        lines.append(" ".join(current))
    return lines


def generate_certificate_pdf(
    certificate_uid: str,
    user_full_name: str,
    course_title: str,
    instructor_name: str,
    completion_date: datetime,
    output_dir: str = None,
) -> str:
    """
    Generate an authentic, prestigious academic PDF certificate for Codexia Academy.
    Uses archival ivory/parchment background, deep academic navy & burnished gold borders,
    official seal, working QR code, dynamic instructor, and authentic verification details.
    """
    if output_dir is None:
        output_dir = os.path.join(settings.UPLOAD_DIR, "certificates")
    ensure_directory(output_dir)

    filename = f"certificate_{certificate_uid}.pdf"
    filepath = os.path.join(output_dir, filename)

    width, height = landscape(A4)
    pdf = canvas.Canvas(filepath, pagesize=landscape(A4))

    # --- 1. PRESTIGIOUS ACADEMIC COLOR PALETTE ---
    BG_IVORY = HexColor("#FCFBF7")        # Archival Ivory Canvas
    BG_WHITE = HexColor("#FFFFFF")        # Pure White Plaque Interior
    NAVY_DEEP = HexColor("#0F172A")       # Slate/Academic Midnight Navy
    NAVY_ACCENT = HexColor("#1E3A8A")     # Royal Academic Blue
    GOLD_BURNISHED = HexColor("#996515")  # Rich Burnished Gold
    GOLD_METALLIC = HexColor("#C5A059")   # Elegant Metallic Gold
    GOLD_LIGHT = HexColor("#FEF3C7")      # Pale Warm Gold Tint
    TEXT_PRIMARY = HexColor("#0F172A")    # Crisp Charcoal/Navy Text
    TEXT_MUTED = HexColor("#475569")      # Neutral Steel Gray
    TEXT_LIGHT = HexColor("#64748B")      # Secondary Descriptor Gray
    BORDER_LIGHT = HexColor("#E2E8F0")    # Subtle Border Tone

    # --- 2. CANVAS & DUAL ARCHIVAL BACKGROUND ---
    # Canvas background: Warm Ivory
    pdf.setFillColor(BG_IVORY)
    pdf.rect(0, 0, width, height, fill=True, stroke=False)

    # Inner certificate plaque: Clean White
    pdf.setFillColor(BG_WHITE)
    pdf.rect(20, 20, width - 40, height - 40, fill=True, stroke=False)

    # --- 3. CLASSICAL SECURITY FRAMES & CORNER FLOURISHES ---
    # Outer Heavy Navy Frame
    pdf.setStrokeColor(NAVY_DEEP)
    pdf.setLineWidth(3.0)
    pdf.rect(26, 26, width - 52, height - 52, fill=False, stroke=True)

    # Burnished Gold Inset Frame
    pdf.setStrokeColor(GOLD_METALLIC)
    pdf.setLineWidth(1.2)
    pdf.rect(32, 32, width - 64, height - 64, fill=False, stroke=True)

    # Thin Interior Navy Pinstripe
    pdf.setStrokeColor(NAVY_DEEP)
    pdf.setLineWidth(0.6)
    pdf.rect(36, 36, width - 72, height - 72, fill=False, stroke=True)

    # Architectural Corner Accents (Corner Brackets & Rosettes)
    corner_size = 28
    corners = [
        (36, 36, 1, 1),
        (width - 36, 36, -1, 1),
        (36, height - 36, 1, -1),
        (width - 36, height - 36, -1, -1),
    ]
    pdf.setStrokeColor(GOLD_BURNISHED)
    pdf.setLineWidth(1.6)
    for cx, cy, dx, dy in corners:
        pdf.line(cx, cy, cx + dx * corner_size, cy)
        pdf.line(cx, cy, cx, cy + dy * corner_size)
        pdf.setFillColor(GOLD_METALLIC)
        pdf.circle(cx + dx * 9, cy + dy * 9, 2.5, fill=True, stroke=False)

    # --- 4. OFFICIAL INSTITUTIONAL CREST & BRANDING ---
    top_y = height - 66
    pdf.setFillColor(NAVY_DEEP)
    pdf.setFont("Helvetica-Bold", 19)
    pdf.drawCentredString(width / 2, top_y, "CODEXIA ACADEMY")

    pdf.setFillColor(GOLD_BURNISHED)
    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawCentredString(width / 2, top_y - 14, "ACCREDITED PLATFORM OF SOFTWARE ARCHITECTURE & ARTIFICIAL INTELLIGENCE")

    pdf.setFillColor(TEXT_LIGHT)
    pdf.setFont("Helvetica", 7.5)
    pdf.drawCentredString(width / 2, top_y - 25, "OFFICIAL VERIFIED ACADEMIC CREDENTIAL • HTTP://CODEXIA.EDU")

    # Symmetric Gold & Navy Divider
    pdf.setStrokeColor(GOLD_METALLIC)
    pdf.setLineWidth(1)
    pdf.line(width / 2 - 160, top_y - 33, width / 2 + 160, top_y - 33)
    pdf.setFillColor(NAVY_DEEP)
    pdf.circle(width / 2, top_y - 33, 3, fill=True, stroke=False)
    pdf.setFillColor(GOLD_METALLIC)
    pdf.circle(width / 2, top_y - 33, 1.5, fill=True, stroke=False)

    # --- 5. CERTIFICATE TITLE & DIGNIFIED STATEMENT ---
    pdf.setFillColor(NAVY_DEEP)
    pdf.setFont("Helvetica-Bold", 24)
    pdf.drawCentredString(width / 2, height - 134, "CERTIFICATE OF COMPLETION")

    pdf.setFillColor(TEXT_MUTED)
    pdf.setFont("Helvetica", 9.5)
    pdf.drawCentredString(width / 2, height - 152, "THIS IS TO OFFICIALLY CERTIFY THAT")

    # --- 6. RECIPIENT REAL NAME ---
    clean_name = (user_full_name or "Student Scholar").strip()
    pdf.setFillColor(NAVY_DEEP)
    pdf.setFont("Helvetica-Bold", 26)
    pdf.drawCentredString(width / 2, height - 186, clean_name)

    # Distinguished Underline with Diamond Rosette
    name_w = pdf.stringWidth(clean_name, "Helvetica-Bold", 26)
    divider_w = max(name_w + 60, 260)
    pdf.setStrokeColor(GOLD_METALLIC)
    pdf.setLineWidth(1.4)
    pdf.line(width / 2 - divider_w / 2, height - 196, width / 2 + divider_w / 2, height - 196)
    pdf.setFillColor(GOLD_BURNISHED)
    pdf.rect(width / 2 - 4, height - 198, 8, 4, fill=True, stroke=False)

    # --- 7. ACHIEVEMENT NARRATIVE ---
    pdf.setFillColor(TEXT_MUTED)
    pdf.setFont("Helvetica", 9.5)
    pdf.drawCentredString(
        width / 2, height - 218,
        "has successfully demonstrated technical mastery, passed practical assessments, and fulfilled all requirements for"
    )

    # --- 8. COURSE TITLE WITH PROPER WRAPPING ---
    lines = _wrap_course_title(course_title or "Advanced Software Engineering Program")
    if len(lines) == 1:
        pdf.setFillColor(NAVY_ACCENT)
        pdf.setFont("Helvetica-Bold", 19)
        pdf.drawCentredString(width / 2, height - 248, lines[0])
        sub_desc_y = height - 270
    else:
        pdf.setFillColor(NAVY_ACCENT)
        pdf.setFont("Helvetica-Bold", 17)
        pdf.drawCentredString(width / 2, height - 244, lines[0])
        pdf.setFont("Helvetica-Bold", 15)
        pdf.drawCentredString(width / 2, height - 264, lines[1])
        sub_desc_y = height - 285

    # Course Accreditation Subtitle
    pdf.setFillColor(TEXT_LIGHT)
    pdf.setFont("Helvetica-Oblique", 8.5)
    pdf.drawCentredString(width / 2, sub_desc_y, "Comprehensive Curriculum • Verified Practical Assessments • Demonstrated Competency")

    # --- 9. THREE-COLUMN SIGNATURE BLOCK & EMBOSSED GOLD SEAL ---
    sig_y = 120

    # Column 1: Course Instructor (Real Dynamic Instructor from DB)
    instructor_display = (instructor_name or "Authorized Course Instructor").strip()
    pdf.setStrokeColor(BORDER_LIGHT)
    pdf.setLineWidth(1.0)
    pdf.line(95, sig_y + 25, 275, sig_y + 25)

    pdf.setFillColor(NAVY_DEEP)
    pdf.setFont("Helvetica-BoldOblique", 13)
    pdf.drawCentredString(185, sig_y + 35, instructor_display)

    pdf.setFont("Helvetica-Bold", 9.5)
    pdf.drawCentredString(185, sig_y + 12, instructor_display)

    pdf.setFillColor(TEXT_MUTED)
    pdf.setFont("Helvetica", 8)
    pdf.drawCentredString(185, sig_y, "Authorized Course Instructor")
    pdf.drawCentredString(185, sig_y - 10, "Codexia Academic Faculty")

    # Column 2: Official Embossed Gold & Navy Institutional Seal
    seal_x = width / 2
    seal_y = sig_y + 14

    # Twin Academic Ribbon Tails (beneath the medallion)
    p_left = pdf.beginPath()
    p_left.moveTo(seal_x - 14, seal_y - 18)
    p_left.lineTo(seal_x - 24, seal_y - 48)
    p_left.lineTo(seal_x - 16, seal_y - 42)
    p_left.lineTo(seal_x - 8, seal_y - 48)
    p_left.lineTo(seal_x - 4, seal_y - 22)
    p_left.close()
    pdf.setFillColor(GOLD_BURNISHED)
    pdf.setStrokeColor(GOLD_METALLIC)
    pdf.setLineWidth(0.6)
    pdf.drawPath(p_left, fill=True, stroke=True)

    p_right = pdf.beginPath()
    p_right.moveTo(seal_x + 14, seal_y - 18)
    p_right.lineTo(seal_x + 24, seal_y - 48)
    p_right.lineTo(seal_x + 16, seal_y - 42)
    p_right.lineTo(seal_x + 8, seal_y - 48)
    p_right.lineTo(seal_x + 4, seal_y - 22)
    p_right.close()
    pdf.setFillColor(GOLD_BURNISHED)
    pdf.setStrokeColor(GOLD_METALLIC)
    pdf.setLineWidth(0.6)
    pdf.drawPath(p_right, fill=True, stroke=True)

    # Outer Metallic Gold Ring
    pdf.setStrokeColor(GOLD_METALLIC)
    pdf.setLineWidth(2.0)
    pdf.setFillColor(BG_WHITE)
    pdf.circle(seal_x, seal_y, 35, fill=True, stroke=True)

    # Middle Antique Gold Border
    pdf.setStrokeColor(GOLD_BURNISHED)
    pdf.setLineWidth(1.0)
    pdf.circle(seal_x, seal_y, 31, fill=False, stroke=True)

    # Core Slate-Navy Disc
    pdf.setFillColor(NAVY_DEEP)
    pdf.circle(seal_x, seal_y, 28, fill=True, stroke=False)

    # Fine Inner Gold Ring
    pdf.setStrokeColor(GOLD_METALLIC)
    pdf.setLineWidth(0.6)
    pdf.circle(seal_x, seal_y, 25, fill=False, stroke=True)

    # Scaled Typography (Guaranteed Zero Clipping within 50pt Core Diameter)
    pdf.setFillColor(GOLD_LIGHT)
    pdf.setFont("Helvetica", 5.5)
    pdf.drawCentredString(seal_x, seal_y + 13, "★   ★   ★")

    pdf.setFont("Helvetica-Bold", 7.5)
    pdf.drawCentredString(seal_x, seal_y + 3.5, "CODEXIA")

    pdf.setFillColor(GOLD_METALLIC)
    pdf.setFont("Helvetica-Bold", 6.5)
    pdf.drawCentredString(seal_x, seal_y - 4.5, "ACADEMY")

    pdf.setFillColor(BG_WHITE)
    pdf.setFont("Helvetica-Bold", 5.0)
    pdf.drawCentredString(seal_x, seal_y - 12.5, "OFFICIAL SEAL")

    pdf.setFillColor(GOLD_LIGHT)
    pdf.setFont("Helvetica", 4.5)
    pdf.drawCentredString(seal_x, seal_y - 19.5, "• 2026 •")

    # Column 3: Institutional Directorate (Official, No Fake Names)
    directorate_display = "Office of Academic Affairs"
    pdf.setStrokeColor(BORDER_LIGHT)
    pdf.setLineWidth(1.0)
    pdf.line(width - 275, sig_y + 25, width - 95, sig_y + 25)

    pdf.setFillColor(NAVY_DEEP)
    pdf.setFont("Helvetica-BoldOblique", 13)
    pdf.drawCentredString(width - 185, sig_y + 35, directorate_display)

    pdf.setFont("Helvetica-Bold", 9.5)
    pdf.drawCentredString(width - 185, sig_y + 12, directorate_display)

    pdf.setFillColor(TEXT_MUTED)
    pdf.setFont("Helvetica", 8)
    pdf.drawCentredString(width - 185, sig_y, "Academic Directorate")
    pdf.drawCentredString(width - 185, sig_y - 10, "Codexia Academy International")

    # --- 10. SECURITY & AUTHENTICATION FOOTER ---
    footer_y = 56
    formatted_date = completion_date.strftime("%B %d, %Y") if hasattr(completion_date, "strftime") else str(completion_date)
    
    # Resolve deployment-ready verification URL
    prod_domain = os.getenv("FRONTEND_URL") or "https://codexia-acadamy.vercel.app"
    if prod_domain.endswith("/"):
        prod_domain = prod_domain[:-1]
    verification_url = f"{prod_domain}/verify/{certificate_uid}"

    # Left: Security Identifiers
    pdf.setFillColor(TEXT_MUTED)
    pdf.setFont("Courier-Bold", 8)
    pdf.drawString(65, footer_y + 12, f"CERTIFICATE UID : {certificate_uid}")
    pdf.setFont("Helvetica", 7.5)
    pdf.drawString(65, footer_y + 1, f"ISSUED ON       : {formatted_date}")
    pdf.setFillColor(NAVY_ACCENT)
    pdf.drawString(65, footer_y - 10, f"REGISTRY LINK   : {verification_url}")

    # Right: High-Resolution Scannable QR Code (Positioned with safe margins)
    qr = qrcode.QRCode(box_size=4, border=1)
    qr.add_data(verification_url)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white")

    qr_buffer = io.BytesIO()
    qr_img.save(qr_buffer, format="PNG")
    qr_buffer.seek(0)
    qr_reader = ImageReader(qr_buffer)

    qr_size = 48
    qr_x = width - 118
    qr_y = 44

    # Gold frame around QR
    pdf.setStrokeColor(GOLD_METALLIC)
    pdf.setLineWidth(1)
    pdf.rect(qr_x - 2, qr_y - 2, qr_size + 4, qr_size + 4, fill=False, stroke=True)
    pdf.drawImage(qr_reader, qr_x, qr_y, width=qr_size, height=qr_size)

    # Clean label safely inside boundary
    pdf.setFillColor(NAVY_DEEP)
    pdf.setFont("Helvetica-Bold", 6)
    pdf.drawCentredString(qr_x + qr_size / 2, qr_y - 9, "SCAN TO AUTHENTICATE")

    pdf.save()
    return filepath
