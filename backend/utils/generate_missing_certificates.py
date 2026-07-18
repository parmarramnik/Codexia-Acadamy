import os
import sys
# Make sure backend directory is in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_db
from models.certificate import Certificate
from utils.pdf_generator import generate_certificate_pdf
from config import settings

def main():
    db = next(get_db())
    try:
        certs = db.query(Certificate).all()
        print(f"Found {len(certs)} certificates in database.")
        for c in certs:
            filename = f"certificate_{c.certificate_uid}.pdf"
            filepath = os.path.join("static", "certificates", filename)
            # Try absolute path fallback too
            abs_filepath = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static", "certificates", filename)
            
            if not os.path.exists(filepath) and not os.path.exists(abs_filepath):
                print(f"Regenerating missing PDF for UID {c.certificate_uid} ({c.user_full_name})...")
                generate_certificate_pdf(
                    certificate_uid=c.certificate_uid,
                    user_full_name=c.user_full_name,
                    course_title=c.course_title,
                    instructor_name=c.instructor_name,
                    completion_date=c.completion_date
                )
                print("Successfully generated PDF on disk!")
            else:
                print(f"PDF already exists on disk for UID {c.certificate_uid}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
