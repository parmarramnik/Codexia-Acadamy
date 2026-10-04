"""
Certificate rendering (ReportLab) and QR code generation.

PDFs are rendered on demand, in memory, from the certificate record in the database.
Nothing is written to local disk, so certificates survive redeploys and restarts on
platforms with ephemeral filesystems (Render, containers), and the QR code always
points at the currently configured public verification URL.
"""

import io
import math
import unicodedata
from datetime import datetime
from typing import List, Optional

import qrcode
from qrcode.constants import ERROR_CORRECT_M
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

# Palette
IVORY = HexColor("#FBF8F1")
NAVY = HexColor("#0E1B30")
NAVY_2 = HexColor("#16294A")
GOLD = HexColor("#B08D57")
GOLD_LIGHT = HexColor("#D8C08E")
INK = HexColor("#1B2333")
MUTED = HexColor("#5B6475")
PANEL_MUTED = HexColor("#9FB0C8")
WHITE = HexColor("#FFFFFF")
GUILLOCHE = Color(0.69, 0.55, 0.34, alpha=0.18)

ISSUER = "Codexia Academy"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe(text: Optional[str]) -> str:
    """Built-in PDF fonts are Latin-1; transliterate anything outside it."""
    text = (text or "").strip()
    try:
        text.encode("latin-1")
        return text
    except UnicodeEncodeError:
        norm = unicodedata.normalize("NFKD", text)
        return "".join(ch for ch in norm if ord(ch) < 256 and not unicodedata.combining(ch)) or "?"


def _fmt_date(value) -> str:
    if hasattr(value, "strftime"):
        return f"{value.strftime('%B')} {value.day}, {value.year}"
    return str(value or "")


def _seed(uid: str) -> int:
    try:
        return int(uid.replace("-", "")[:8], 16)
    except ValueError:
        return 0x9E3779B9


def mulberry32(seed: int):
    """Small deterministic PRNG (mirrors frontend/src/utils/certificates.js)."""
    state = [seed & 0xFFFFFFFF]

    def imul(a, b):
        return (a * b) & 0xFFFFFFFF

    def nxt():
        state[0] = (state[0] + 0x6D2B79F5) & 0xFFFFFFFF
        a = state[0]
        t = imul(a ^ (a >> 15), 1 | a)
        t = ((t + imul(t ^ (t >> 7), 61 | t)) & 0xFFFFFFFF) ^ t
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    return nxt


def guilloche_params(uid: str) -> dict:
    """Per-certificate security pattern parameters (unique to each certificate)."""
    rnd = mulberry32(_seed(uid))
    return {
        "k1": 10 + int(rnd() * 9),        # outer petals
        "k2": 3 + int(rnd() * 5),         # inner modulation
        "a1": 0.10 + rnd() * 0.06,
        "a2": 0.04 + rnd() * 0.04,
        "phase": rnd() * math.pi * 2,
        "rings": 11,
    }


def _wrap(pdf, text: str, font: str, size: float, max_width: float) -> List[str]:
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = f"{cur} {w}".strip()
        if pdf.stringWidth(trial, font, size) <= max_width or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def _fit(pdf, text: str, font: str, max_size: float, min_size: float, max_width: float) -> float:
    size = max_size
    while size > min_size and pdf.stringWidth(text, font, size) > max_width:
        size -= 0.5
    return size


def _spaced(pdf, text: str, x: float, y: float, font: str, size: float, spacing: float, align="center"):
    width = pdf.stringWidth(text, font, size) + spacing * (len(text) - 1)
    start = x - width / 2 if align == "center" else (x - width if align == "right" else x)
    t = pdf.beginText(start, y)
    t.setFont(font, size)
    t.setCharSpace(spacing)
    t.textOut(text)
    t.setCharSpace(0)  # Tc persists in the PDF graphics state; reset it for later text
    pdf.drawText(t)


def _circle_text(pdf, text: str, cx: float, cy: float, radius: float, font: str, size: float):
    pdf.setFont(font, size)
    step = 360.0 / len(text)
    for i, ch in enumerate(text):
        angle = 90 - i * step
        pdf.saveState()
        pdf.translate(cx, cy)
        pdf.rotate(angle - 90)
        pdf.drawCentredString(0, radius, ch)
        pdf.restoreState()


def _qr_matrix(data: str):
    qr = qrcode.QRCode(error_correction=ERROR_CORRECT_M, border=0, box_size=1)
    qr.add_data(data)
    qr.make(fit=True)
    return qr.get_matrix()


def render_qr_png(data: str, scale: int = 10, border: int = 4) -> bytes:
    qr = qrcode.QRCode(error_correction=ERROR_CORRECT_M, border=border, box_size=scale)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def render_qr_svg(data: str, border: int = 4) -> str:
    """Crisp, dependency-free SVG QR code (one path, scales to any size)."""
    matrix = _qr_matrix(data)
    n = len(matrix)
    size = n + border * 2
    parts = []
    for y, row in enumerate(matrix):
        x = 0
        while x < n:
            if row[x]:
                start = x
                while x < n and row[x]:
                    x += 1
                parts.append(f"M{start + border} {y + border}h{x - start}v1h-{x - start}z")
            else:
                x += 1
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" '
        f'shape-rendering="crispEdges" role="img" aria-label="Certificate verification QR code">'
        f'<rect width="{size}" height="{size}" fill="#fff"/>'
        f'<path d="{"".join(parts)}" fill="#000"/></svg>'
    )


def _draw_guilloche(pdf, cx: float, cy: float, radius: float, uid: str):
    p = guilloche_params(uid)
    pdf.saveState()
    pdf.setStrokeColor(GUILLOCHE)
    pdf.setLineWidth(0.35)
    steps = 720
    for ring in range(p["rings"]):
        base = radius * (0.38 + 0.6 * ring / (p["rings"] - 1))
        shift = p["phase"] + ring * 0.21
        path = pdf.beginPath()
        for i in range(steps + 1):
            th = 2 * math.pi * i / steps
            r = base * (1 + p["a1"] * math.sin(p["k1"] * th + shift) + p["a2"] * math.cos(p["k2"] * th - shift))
            x, y = cx + r * math.cos(th), cy + r * math.sin(th)
            if i == 0:
                path.moveTo(x, y)
            else:
                path.lineTo(x, y)
        pdf.drawPath(path, stroke=1, fill=0)
    pdf.restoreState()


def _draw_seal(pdf, cx: float, cy: float, year: int):
    # Serrated gold rosette
    points = 60
    path = pdf.beginPath()
    for i in range(points * 2 + 1):
        r = 40 if i % 2 == 0 else 37
        a = math.pi * i / points
        x, y = cx + r * math.cos(a), cy + r * math.sin(a)
        if i == 0:
            path.moveTo(x, y)
        else:
            path.lineTo(x, y)
    path.close()
    pdf.setFillColor(GOLD)
    pdf.setStrokeColor(GOLD)
    pdf.setLineWidth(0.5)
    pdf.drawPath(path, fill=1, stroke=1)

    pdf.setFillColor(NAVY)
    pdf.circle(cx, cy, 33, fill=1, stroke=0)
    pdf.setStrokeColor(GOLD_LIGHT)
    pdf.setLineWidth(0.6)
    pdf.circle(cx, cy, 31, fill=0, stroke=1)
    pdf.circle(cx, cy, 19, fill=0, stroke=1)

    pdf.setFillColor(GOLD_LIGHT)
    _circle_text(pdf, " CODEXIA ACADEMY · VERIFIED CREDENTIAL ·", cx, cy, 23.2, "Helvetica-Bold", 5.2)

    pdf.setFillColor(WHITE)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawCentredString(cx, cy + 0.5, "</>")
    pdf.setFillColor(GOLD_LIGHT)
    pdf.setFont("Helvetica-Bold", 6)
    pdf.drawCentredString(cx, cy - 8, str(year))


# ---------------------------------------------------------------------------
# Certificate
# ---------------------------------------------------------------------------

def render_certificate_pdf(
    *,
    certificate_uid: str,
    credential_id: str,
    verification_code: str,
    user_full_name: str,
    course_title: str,
    instructor_name: str,
    completion_date: datetime,
    verification_url: str,
    duration_hours: Optional[float] = None,
    total_lectures: Optional[int] = None,
) -> bytes:
    """Render the certificate as a single-page landscape A4 PDF and return the bytes."""
    buf = io.BytesIO()
    W, H = landscape(A4)
    pdf = canvas.Canvas(buf, pagesize=(W, H))

    name = _safe(user_full_name) or "Certificate Holder"
    course = _safe(course_title) or "Course"
    instructor = _safe(instructor_name) or "Course Instructor"
    issued = _fmt_date(completion_date)
    year = completion_date.year if hasattr(completion_date, "year") else datetime.utcnow().year

    pdf.setTitle(f"Certificate of Completion - {name} - {course}")
    pdf.setAuthor(ISSUER)
    pdf.setSubject(f"Credential {credential_id} - verify at {verification_url}")
    pdf.setCreator(f"{ISSUER} Credential Service")
    pdf.setKeywords(f"certificate, {credential_id}, {certificate_uid}")

    # --- Background, security pattern and frame ---
    pdf.setFillColor(IVORY)
    pdf.rect(0, 0, W, H, fill=1, stroke=0)

    panel_w = 214
    main_x0, main_x1 = 20 + panel_w + 28, W - 48
    cx = (main_x0 + main_x1) / 2

    _draw_guilloche(pdf, cx, H / 2 + 18, 190, certificate_uid)

    pdf.setStrokeColor(NAVY)
    pdf.setLineWidth(2)
    pdf.rect(12, 12, W - 24, H - 24, fill=0, stroke=1)
    pdf.setStrokeColor(GOLD)
    pdf.setLineWidth(0.8)
    pdf.rect(17, 17, W - 34, H - 34, fill=0, stroke=1)

    # Microtext security lines (top and bottom of the main area)
    pdf.setFillColor(GOLD)
    micro = (f"{ISSUER.upper()} · {credential_id} · ") * 40
    pdf.setFont("Helvetica", 3.4)
    for y in (H - 28, 26):
        pdf.saveState()
        p = pdf.beginPath()
        p.rect(main_x0 - 10, y - 2, (W - 22) - (main_x0 - 10), 6)
        pdf.clipPath(p, stroke=0, fill=0)
        pdf.drawString(main_x0 - 10, y, micro)
        pdf.restoreState()

    # --- Left identity panel ---
    pdf.setFillColor(NAVY)
    pdf.rect(20, 20, panel_w, H - 40, fill=1, stroke=0)
    pdf.setFillColor(NAVY_2)
    pdf.rect(20 + panel_w - 3, 20, 3, H - 40, fill=1, stroke=0)
    pdf.setFillColor(GOLD)
    pdf.rect(20 + panel_w, 20, 1.2, H - 40, fill=1, stroke=0)

    px = 20 + panel_w / 2
    # Brand mark
    pdf.setStrokeColor(GOLD)
    pdf.setLineWidth(1.2)
    pdf.roundRect(px - 18, H - 92, 36, 36, 8, fill=0, stroke=1)
    pdf.setFillColor(GOLD_LIGHT)
    pdf.setFont("Helvetica-Bold", 13)
    pdf.drawCentredString(px, H - 79, "</>")
    pdf.setFillColor(WHITE)
    _spaced(pdf, "CODEXIA", px, H - 118, "Helvetica-Bold", 15, 3.2)
    pdf.setFillColor(GOLD_LIGHT)
    _spaced(pdf, "ACADEMY", px, H - 132, "Helvetica", 7.5, 4.2)

    pdf.setStrokeColor(Color(1, 1, 1, alpha=0.14))
    pdf.setLineWidth(0.6)
    pdf.line(44, H - 152, 20 + panel_w - 24, H - 152)

    def field(label: str, value: str, y: float, font="Courier-Bold", size=10.5):
        pdf.setFillColor(GOLD_LIGHT)
        _spaced(pdf, label, 44, y, "Helvetica-Bold", 6.2, 1.6, align="left")
        pdf.setFillColor(WHITE)
        pdf.setFont(font, size)
        pdf.drawString(44, y - 14, value)

    field("CREDENTIAL ID", credential_id, H - 180)
    field("DATE OF ISSUE", issued, H - 218, font="Helvetica-Bold", size=10)
    field("VERIFICATION CODE", verification_code or "-", H - 256, size=9.5)

    # QR tile
    qr_tile = 132
    qx, qy = px - qr_tile / 2, 92
    pdf.setFillColor(WHITE)
    pdf.roundRect(qx, qy, qr_tile, qr_tile, 6, fill=1, stroke=0)
    qr_img = ImageReader(io.BytesIO(render_qr_png(verification_url, scale=10, border=2)))
    pdf.drawImage(qr_img, qx + 6, qy + 6, width=qr_tile - 12, height=qr_tile - 12)

    pdf.setFillColor(WHITE)
    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawCentredString(px, qy - 16, "Scan to verify authenticity")
    pdf.setFillColor(PANEL_MUTED)
    host, _, path = verification_url.split("://", 1)[-1].partition("/")
    for i, line in enumerate((host, "/" + path)):
        size = _fit(pdf, line, "Helvetica", 6.2, 4.5, panel_w - 36)
        pdf.setFont("Helvetica", size)
        pdf.drawCentredString(px, qy - 29 - i * 8, line)

    # --- Main content ---
    pdf.setFillColor(GOLD)
    _spaced(pdf, "CERTIFICATE OF COMPLETION", cx, H - 84, "Helvetica-Bold", 11, 4.2)
    pdf.setStrokeColor(GOLD)
    pdf.setLineWidth(0.7)
    pdf.line(cx - 120, H - 98, cx - 10, H - 98)
    pdf.line(cx + 10, H - 98, cx + 120, H - 98)
    d = pdf.beginPath()
    d.moveTo(cx, H - 94); d.lineTo(cx + 4, H - 98); d.lineTo(cx, H - 102); d.lineTo(cx - 4, H - 98); d.close()
    pdf.setFillColor(GOLD)
    pdf.drawPath(d, fill=1, stroke=0)

    pdf.setFillColor(MUTED)
    pdf.setFont("Times-Italic", 14)
    pdf.drawCentredString(cx, H - 146, "This is to certify that")

    name_size = _fit(pdf, name, "Times-Bold", 40, 22, main_x1 - main_x0 - 30)
    pdf.setFillColor(INK)
    pdf.setFont("Times-Bold", name_size)
    pdf.drawCentredString(cx, H - 196, name)
    name_w = min(pdf.stringWidth(name, "Times-Bold", name_size) + 70, main_x1 - main_x0)
    pdf.setStrokeColor(GOLD)
    pdf.setLineWidth(0.8)
    pdf.line(cx - name_w / 2, H - 212, cx + name_w / 2, H - 212)

    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", 10.5)
    pdf.drawCentredString(cx, H - 240, "has successfully completed all requirements of the course")

    course_size = 20
    lines = _wrap(pdf, course, "Helvetica-Bold", course_size, main_x1 - main_x0 - 40)
    while len(lines) > 3 and course_size > 13:
        course_size -= 1
        lines = _wrap(pdf, course, "Helvetica-Bold", course_size, main_x1 - main_x0 - 40)
    lines = lines[:3]
    pdf.setFillColor(NAVY)
    y = H - 272
    for line in lines:
        pdf.setFont("Helvetica-Bold", course_size)
        pdf.drawCentredString(cx, y, line)
        y -= course_size + 5

    meta = ["Online program"]
    if duration_hours:
        meta.append(f"{duration_hours:g} learning hours")
    if total_lectures:
        meta.append(f"{total_lectures} lectures")
    meta.append(f"Completed {issued}")
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", 9)
    pdf.drawCentredString(cx, y - 6, "  ·  ".join(meta))

    # --- Signatures and seal ---
    sig_y = 104
    left_x, right_x = cx - 168, cx + 168

    pdf.setFillColor(INK)
    sig_size = _fit(pdf, instructor, "Times-Italic", 19, 11, 170)
    pdf.setFont("Times-Italic", sig_size)
    pdf.drawCentredString(left_x, sig_y + 8, instructor)
    pdf.setStrokeColor(INK)
    pdf.setLineWidth(0.6)
    pdf.line(left_x - 88, sig_y, left_x + 88, sig_y)
    pdf.setFont("Helvetica-Bold", 8.5)
    pdf.drawCentredString(left_x, sig_y - 13, instructor)
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", 7.5)
    pdf.drawCentredString(left_x, sig_y - 24, "Course Instructor")

    pdf.setFillColor(INK)
    pdf.setFont("Times-Italic", 17)
    pdf.drawCentredString(right_x, sig_y + 8, ISSUER)
    pdf.line(right_x - 88, sig_y, right_x + 88, sig_y)
    pdf.setFont("Helvetica-Bold", 8.5)
    pdf.drawCentredString(right_x, sig_y - 13, "Office of Academic Records")
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", 7.5)
    pdf.drawCentredString(right_x, sig_y - 24, "Issuing Authority")

    _draw_seal(pdf, cx, sig_y - 2, year)

    # --- Footer ---
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", 6.8)
    pdf.drawCentredString(
        cx, 40,
        f"Verify this credential at {verification_url}",
    )

    pdf.showPage()
    pdf.save()
    return buf.getvalue()
