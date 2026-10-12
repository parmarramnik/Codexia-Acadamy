"""
Payment Service entrypoint.
Port: 8007
Owns: /payments, /pricing
"""
import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from routes import payments, pricing
from microservices.shared.factory import create_service_app

SERVICE_NAME = "Payment Service"
SERVICE_PORT = 8007

def _checks() -> dict:
    from config import settings
    ok = settings.payments_configured
    return {"payments": {"status": "healthy" if ok else "degraded", "configured": ok, "webhook_secret": bool(settings.RAZORPAY_WEBHOOK_SECRET)}}

app = create_service_app(
    SERVICE_NAME,
    SERVICE_PORT,
    [
        (payments.router, "/payments"),
        (pricing.router, "/pricing"),
    ],
    extra_checks=_checks,
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=SERVICE_PORT)
