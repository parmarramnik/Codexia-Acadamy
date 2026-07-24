import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formatdate, make_msgid, formataddr
from config import settings

logger = logging.getLogger("EmailService")

# Official authorized email addresses for privileged roles
ADMIN_OFFICIAL_EMAIL = "parmarramnik408@gmail.com"
INSTRUCTOR_OFFICIAL_EMAIL = "23bce212@nirmauni.ac.in"


def _get_sender_domain():
    """Extract domain from the FROM_EMAIL for Message-ID generation."""
    from_email = settings.FROM_EMAIL or "noreply@codexia.com"
    if "@" in from_email:
        return from_email.split("@")[1]
    return "gmail.com"


def send_email(subject: str, recipient: str, body_html: str, body_text: str):
    """
    Send an email via SMTP with anti-spam best practices for Gmail inbox delivery.
    Uses proper RFC 5322 headers, matching sender domain for Message-ID,
    and multipart/alternative MIME structure.
    """
    host = settings.SMTP_HOST
    port = settings.SMTP_PORT
    user = settings.SMTP_USER
    password = settings.SMTP_PASSWORD
    from_email = settings.FROM_EMAIL

    if not host or not user or not password:
        logger.warning("SMTP not configured — falling back to console output.")
        print("\n" + "=" * 60)
        print(f"[EMAIL FALLBACK] To: {recipient}")
        print(f"Subject: {subject}")
        print(f"Content: {body_text}")
        print("=" * 60 + "\n")
        return True

    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        # Use formataddr for proper RFC 5322 From header
        msg['From'] = formataddr(("Codexia Academy", from_email))
        msg['To'] = recipient
        msg['Reply-To'] = from_email
        msg['Date'] = formatdate(localtime=True)
        # Use the actual sender domain for Message-ID to avoid spam flags
        msg['Message-ID'] = make_msgid(domain=_get_sender_domain())
        # Anti-spam: mark as transactional, not promotional
        msg['X-Priority'] = '1'
        msg['X-Mailer'] = 'Codexia-Academy-LMS'

        # Attach plain text first, then HTML (RFC 2046 order)
        part_text = MIMEText(body_text, 'plain', 'utf-8')
        part_html = MIMEText(body_html, 'html', 'utf-8')
        msg.attach(part_text)
        msg.attach(part_html)

        if port == 465:
            server = smtplib.SMTP_SSL(host, port, timeout=15)
        else:
            server = smtplib.SMTP(host, port, timeout=15)
            server.ehlo()
            server.starttls()
            server.ehlo()

        server.login(user, password)
        server.sendmail(from_email, [recipient], msg.as_string())
        server.quit()
        logger.info(f"Email sent successfully to {recipient} | Subject: {subject}")
        return True

    except Exception as e:
        logger.error(f"SMTP send failed to {recipient}: {e}")
        print("\n" + "=" * 60)
        print(f"[SMTP ERROR] To: {recipient} | Error: {e}")
        print(f"Subject: {subject}")
        print(f"Body: {body_text}")
        print("=" * 60 + "\n")
        return False


def _determine_otp_recipient(email: str, role: str):
    """
    Determine where the OTP should be sent based on the requested role.

    Rules:
    - If user requests admin/super_admin role → OTP goes to ADMIN_OFFICIAL_EMAIL
    - If user requests instructor role → OTP goes to INSTRUCTOR_OFFICIAL_EMAIL
    - If user IS the admin/instructor email themselves → OTP goes to their own email
    - Student role → OTP goes to the user's own email

    Returns: (target_recipient, is_role_approval)
    """
    clean_email = email.strip().lower()
    clean_role = str(role).strip().lower()

    # If the user IS the official admin/instructor, send OTP to themselves
    if clean_email == ADMIN_OFFICIAL_EMAIL.lower():
        return ADMIN_OFFICIAL_EMAIL, False
    if clean_email == INSTRUCTOR_OFFICIAL_EMAIL.lower():
        return INSTRUCTOR_OFFICIAL_EMAIL, False

    # If someone else requests a privileged role, route OTP to the official holder
    if clean_role in ("admin", "super_admin"):
        return ADMIN_OFFICIAL_EMAIL, True
    if clean_role == "instructor":
        return INSTRUCTOR_OFFICIAL_EMAIL, True

    # Default: student — send OTP to user's own email
    return email, False


def send_verification_email(email: str, otp: str, role: str = "student", requester_email: str = None):
    """
    Send 6-digit OTP verification code.

    Role-based routing:
    - Students: OTP sent to the user's own email
    - Admin/Instructor requests from non-official emails: OTP sent to official admin/instructor email
    - Official admin/instructor signing up: OTP sent to their own email
    """
    req_email = (requester_email or email).strip().lower()
    target_recipient, is_role_approval = _determine_otp_recipient(email, role)
    clean_role = str(role).strip().lower()

    if is_role_approval:
        # OTP goes to the official admin/instructor for approval
        subject = f"[SECURITY] {clean_role.upper()} Access Request - OTP Verification"
        body_text = (
            f"Codexia Academy Security Alert\n\n"
            f"A new user ({req_email}) has requested {clean_role.upper()} access.\n\n"
            f"Verification OTP: {otp}\n\n"
            f"This code expires in 60 seconds.\n"
            f"Share this OTP with the user ONLY if you approve their access request.\n\n"
            f"If you did not expect this request, please ignore this email.\n"
            f"- Codexia Academy Security"
        )
        body_html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background-color:#f4f4f7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <tr><td style="background:linear-gradient(135deg,#d32f2f,#b71c1c);padding:32px 24px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:600;">Security: {clean_role.upper()} Access Request</h1>
    </td></tr>
    <tr><td style="padding:32px 28px;">
      <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 16px;">
        A new user has requested <strong>{clean_role.upper()}</strong> privileges on Codexia Academy:
      </p>
      <table style="background:#f8f9fa;border-radius:8px;padding:12px 16px;width:100%;margin:0 0 24px;">
        <tr><td style="color:#666;font-size:14px;padding:6px 0;">Requester Email:</td>
            <td style="color:#333;font-size:14px;font-weight:600;padding:6px 0;">{req_email}</td></tr>
        <tr><td style="color:#666;font-size:14px;padding:6px 0;">Requested Role:</td>
            <td style="color:#d32f2f;font-size:14px;font-weight:600;padding:6px 0;">{clean_role.upper()}</td></tr>
      </table>
      <p style="color:#333;font-size:15px;margin:0 0 12px;">To approve this request, provide this OTP to the user:</p>
      <div style="text-align:center;margin:24px 0;">
        <span style="display:inline-block;font-size:34px;font-weight:700;letter-spacing:10px;color:#d32f2f;background:#ffebee;padding:14px 28px;border-radius:10px;border:2px dashed #d32f2f;">{otp}</span>
      </div>
      <p style="text-align:center;color:#d32f2f;font-size:13px;font-weight:600;margin:0 0 24px;">This code expires in 60 seconds</p>
      <hr style="border:0;border-top:1px solid #eee;margin:24px 0;">
      <p style="color:#999;font-size:12px;text-align:center;margin:0;">
        If you did not expect this request, no action is needed.<br>
        Codexia Academy Security System
      </p>
    </td></tr>
  </table>
</body>
</html>"""
    else:
        # Standard student verification or official admin/instructor self-signup
        subject = "Your Verification Code - Codexia Academy"
        body_text = (
            f"Welcome to Codexia Academy!\n\n"
            f"Your 6-digit verification code is: {otp}\n\n"
            f"This code expires in 60 seconds.\n"
            f"Enter it on the verification page to activate your account.\n\n"
            f"If you didn't create an account, please ignore this email.\n"
            f"- Codexia Academy"
        )
        body_html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background-color:#f4f4f7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <tr><td style="background:linear-gradient(135deg,#FF9800,#F57C00);padding:32px 24px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:600;">Welcome to Codexia Academy</h1>
    </td></tr>
    <tr><td style="padding:32px 28px;">
      <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 20px;">
        Thank you for signing up! Use the code below to verify your account:
      </p>
      <div style="text-align:center;margin:24px 0;">
        <span style="display:inline-block;font-size:34px;font-weight:700;letter-spacing:10px;color:#FF9800;background:#FFF3E0;padding:14px 28px;border-radius:10px;border:2px dashed #FF9800;">{otp}</span>
      </div>
      <p style="text-align:center;color:#e53935;font-size:13px;font-weight:600;margin:0 0 24px;">This code expires in 60 seconds</p>
      <hr style="border:0;border-top:1px solid #eee;margin:24px 0;">
      <p style="color:#999;font-size:12px;text-align:center;margin:0;">
        If you didn't create this account, you can safely ignore this email.<br>
        Codexia Academy LMS Platform
      </p>
    </td></tr>
  </table>
</body>
</html>"""

    success = send_email(subject, target_recipient, body_html, body_text)
    if success:
        logger.info(f"OTP sent to {target_recipient} (requester: {req_email}, role: {clean_role}, approval: {is_role_approval})")
    return success


# Alias for backward compatibility
send_verification_otp = send_verification_email


def send_otp_reset_email(email: str, otp: str):
    """Send 6-digit OTP code for password reset."""
    subject = "Password Reset Code - Codexia Academy"
    body_text = (
        f"We received a request to reset your password for Codexia Academy.\n\n"
        f"Your 6-digit reset code is: {otp}\n\n"
        f"This code expires in 15 minutes.\n"
        f"If you did not request this, please secure your account immediately.\n"
        f"- Codexia Academy"
    )
    body_html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background-color:#f4f4f7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <tr><td style="background:linear-gradient(135deg,#FF9800,#F57C00);padding:32px 24px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:600;">Reset Your Password</h1>
    </td></tr>
    <tr><td style="padding:32px 28px;">
      <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 20px;">
        Use the code below to reset your Codexia Academy password:
      </p>
      <div style="text-align:center;margin:24px 0;">
        <span style="display:inline-block;font-size:34px;font-weight:700;letter-spacing:10px;color:#FF9800;background:#FFF3E0;padding:14px 28px;border-radius:10px;border:2px dashed #FF9800;">{otp}</span>
      </div>
      <p style="text-align:center;color:#666;font-size:13px;margin:0 0 24px;">This code expires in 15 minutes</p>
      <hr style="border:0;border-top:1px solid #eee;margin:24px 0;">
      <p style="color:#999;font-size:12px;text-align:center;margin:0;">
        If you didn't request a password reset, please ignore this email.<br>
        Codexia Academy LMS Platform
      </p>
    </td></tr>
  </table>
</body>
</html>"""
    return send_email(subject, email, body_html, body_text)
