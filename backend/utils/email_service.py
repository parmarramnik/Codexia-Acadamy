import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
from config import settings

logger = logging.getLogger("EmailService")

def send_email(subject: str, recipient: str, body_html: str, body_text: str):
    """Sends a real email using SMTP or prints to stdout if credentials are not configured."""
    host = settings.SMTP_HOST
    port = settings.SMTP_PORT
    user = settings.SMTP_USER
    password = settings.SMTP_PASSWORD
    from_email = settings.FROM_EMAIL

    # Check if SMTP settings are fully populated
    if not host or not user or not password:
        logger.warning("SMTP configuration is incomplete. Falling back to stdout developer logging.")
        print("\n" + "="*60)
        print(f"DEVELOPER EMAIL FALLBACK NOTICE")
        print(f"To:      {recipient}")
        print(f"Subject: {subject}")
        print(f"Content: {body_text}")
        print("="*60 + "\n")
        return True

    try:
        # Create message container
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = from_email
        msg['To'] = recipient

        # Attach text and html versions
        part1 = MIMEText(body_text, 'plain')
        part2 = MIMEText(body_html, 'html')
        msg.attach(part1)
        msg.attach(part2)

        # Connect to SMTP server
        # Support both standard SMTP (typically 587 with STARTTLS) and SSL (465)
        if port == 465:
            server = smtplib.SMTP_SSL(host, port, timeout=10)
        else:
            server = smtplib.SMTP(host, port, timeout=10)
            server.ehlo()
            server.starttls()
            server.ehlo()

        server.login(user, password)
        server.sendmail(from_email, recipient, msg.as_string())
        server.quit()
        logger.info(f"Successfully sent email to {recipient}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {recipient} via SMTP: {str(e)}")
        # Print fallback so the developer doesn't get blocked by bad credentials
        print("\n" + "="*60)
        print(f"SMTP ERROR FALLBACK LOG (SMTP Failed: {str(e)})")
        print(f"To:      {recipient}")
        print(f"Subject: {subject}")
        print(f"Content: {body_text}")
        print("="*60 + "\n")
        return True

def send_verification_email(email: str, token: str):
    """Send signup verification link."""
    verify_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    subject = "Verify Your Account - Codexia Academy"
    
    body_text = (
        f"Welcome to Codexia Academy!\n\n"
        f"Please verify your account by visiting the following link:\n"
        f"{verify_url}\n\n"
        f"If you did not sign up for this account, please ignore this email."
    )
    
    body_html = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #ff9800; text-align: center;">Welcome to Codexia Academy!</h2>
        <p>Thank you for signing up. Please verify your email address to unlock your coding learning workspace.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="{verify_url}" style="background-color: #ff9800; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Verify Email Address</a>
        </div>
        <p style="font-size: 0.85em; color: #666666;">Or copy and paste this link into your browser: <br/> {verify_url}</p>
        <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;"/>
        <p style="font-size: 0.8em; color: #999999; text-align: center;">Codexia Academy LMS Platform &copy; 2026</p>
      </body>
    </html>
    """
    return send_email(subject, email, body_html, body_text)

def send_otp_reset_email(email: str, otp: str):
    """Send 6-digit numeric OTP code for password reset."""
    subject = "Password Reset Code - Codexia Academy"
    
    body_text = (
        f"We received a request to reset your password for Codexia Academy.\n\n"
        f"Your 6-digit verification code is:\n"
        f"{otp}\n\n"
        f"This code will expire in 15 minutes. If you did not request this, please secure your account immediately."
    )
    
    body_html = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #ff9800; text-align: center;">Reset Your Password</h2>
        <p>We received a request to reset your Codexia Academy password. Use the verification code below to complete the reset process:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #ff9800; background-color: #f5f5f5; padding: 10px 20px; border-radius: 4px; border: 1px dashed #cccccc; display: inline-block;">{otp}</span>
        </div>
        <p>This code will expire in 15 minutes.</p>
        <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;"/>
        <p style="font-size: 0.8em; color: #999999; text-align: center;">If you did not request a password reset, please ignore this email.</p>
      </body>
    </html>
    """
    return send_email(subject, email, body_html, body_text)
