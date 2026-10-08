"""
Payment routes — Razorpay order creation, checkout verification, webhook, status,
and admin payment management.

The webhook endpoint reads the raw request body (never a parsed model) so the
X-Razorpay-Signature HMAC is computed over exactly the bytes Razorpay signed.
"""

import hashlib
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from auth.oauth2 import get_current_user
from auth.permissions import require_role
from config import settings
from database import get_db
from middleware.rate_limiter import limiter
from models.course import Course
from models.payment import Payment, PaymentStatus
from models.user import User, UserRole
from schemas.payment import CreateOrderRequest, RefundRequest, VerifyPaymentRequest
from services import payment_service, razorpay_client
from services.audit_service import log_audit_event
from services.payment_service import PaymentFlowError

logger = logging.getLogger("codexia.payments.routes")

router = APIRouter()


def _per_user_key(request: Request) -> str:
    """Rate-limit per authenticated user (behind Render's proxy many clients can share one IP)."""
    auth = request.headers.get("authorization", "")
    if auth:
        return "u:" + hashlib.sha256(auth.encode("utf-8")).hexdigest()[:24]
    return get_remote_address(request)


def _flow_error(exc: PaymentFlowError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail={"message": exc.message, "code": exc.code})


# --------------------------------------------------------------------------- student

@router.post("/razorpay/order")
@limiter.limit("10/minute", key_func=_per_user_key)
def create_razorpay_order(
    request: Request,
    data: CreateOrderRequest,
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """Create (or reuse) a Razorpay order. The amount is read from the database, never the client."""
    try:
        payment, course = payment_service.create_order(db, current_user, data.course_id)
    except PaymentFlowError as exc:
        raise _flow_error(exc)
    return {
        "order_id": payment.razorpay_order_id,
        "key_id": settings.RAZORPAY_KEY_ID,  # Public key only
        "amount": payment.amount,
        "currency": payment.currency,
        "course": {"id": course.id, "title": course.title, "slug": course.slug},
        "prefill": {"name": current_user.full_name, "email": current_user.email},
    }


@router.post("/razorpay/verify")
@limiter.limit("20/minute", key_func=_per_user_key)
def verify_razorpay_payment(
    request: Request,
    data: VerifyPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Verify the Checkout signature server-side, confirm capture with Razorpay, then grant access."""
    try:
        payment = payment_service.verify_checkout(
            db, current_user, data.razorpay_order_id, data.razorpay_payment_id, data.razorpay_signature,
        )
    except PaymentFlowError as exc:
        raise _flow_error(exc)
    return payment_service.serialize_payment_for_user(payment)


@router.get("/orders/{order_id}/status")
@limiter.limit("60/minute", key_func=_per_user_key)
def get_order_status(
    request: Request,
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Authoritative payment status for the learner's own order (reconciles with Razorpay if open)."""
    if not payment_service.ORDER_ID_RE.match(order_id or ""):
        raise HTTPException(status_code=400, detail="Invalid order ID")
    payment = (
        db.query(Payment)
        .filter(Payment.razorpay_order_id == order_id, Payment.user_id == current_user.id)
        .first()
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    payment = payment_service.reconcile_payment(db, payment)
    enrolled = bool(
        payment.course_id and payment_service.get_active_enrollment(db, current_user.id, payment.course_id)
    )
    return payment_service.serialize_payment_for_user(payment, enrolled)


@router.get("/courses/{course_id}/state")
def get_course_purchase_state(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Enrollment + latest payment for this learner and course (drives the Buy / Enrolled UI)."""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return payment_service.course_purchase_state(db, current_user, course)


@router.get("/me")
def list_my_payments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The learner's own purchase history."""
    rows = (
        db.query(Payment)
        .filter(Payment.user_id == current_user.id)
        .order_by(Payment.created_at.desc())
        .limit(100)
        .all()
    )
    return [payment_service.serialize_payment_for_user(p) for p in rows]


# --------------------------------------------------------------------------- webhook

@router.post("/razorpay/webhook", include_in_schema=False)
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    """Razorpay webhook. Verifies X-Razorpay-Signature over the raw body before doing anything."""
    raw_body = await request.body()
    signature = request.headers.get("x-razorpay-signature", "")

    if not settings.RAZORPAY_WEBHOOK_SECRET:
        logger.error("Razorpay webhook received but RAZORPAY_WEBHOOK_SECRET is not configured")
        return JSONResponse(status_code=503, content={"detail": "Webhook not configured"})
    if not razorpay_client.verify_webhook_signature(raw_body, signature):
        logger.warning("Rejected Razorpay webhook with invalid signature")
        return JSONResponse(status_code=400, content={"detail": "Invalid signature"})

    try:
        # DB work and possible capture calls are blocking: keep them off the event loop.
        result = await run_in_threadpool(
            payment_service.handle_webhook, db, raw_body, request.headers.get("x-razorpay-event-id"),
        )
    except PaymentFlowError as exc:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})
    except Exception as exc:
        # Non-2xx makes Razorpay retry; processing is idempotent so retries are safe.
        logger.error("Razorpay webhook processing error: %s", type(exc).__name__)
        return JSONResponse(status_code=500, content={"detail": "Webhook processing failed"})
    return result


# --------------------------------------------------------------------------- admin

@router.get("/admin/summary")
def admin_payment_summary(
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    return payment_service.admin_summary(db)


@router.get("/admin/list")
def admin_list_payments(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None, max_length=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    if status and status.upper() not in {s.value for s in PaymentStatus}:
        raise HTTPException(status_code=400, detail="Invalid status filter")
    return payment_service.admin_list_payments(db, status, search, page, page_size)


@router.post("/admin/{payment_id}/refund")
def admin_refund_payment(
    payment_id: int,
    data: RefundRequest,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Issue a full refund through Razorpay. Status becomes REFUNDED only when Razorpay confirms it."""
    if not db.query(Payment.id).filter(Payment.id == payment_id).first():
        raise HTTPException(status_code=404, detail="Payment not found")
    try:
        payment = payment_service.refund_payment(db, payment_id, current_user, data.reason)
    except PaymentFlowError as exc:
        raise _flow_error(exc)
    log_audit_event(db, current_user.id, "refund_payment", "payment", str(payment_id),
                    previous_value=PaymentStatus.SUCCESS.value,
                    new_value=f"refund {payment.refund_status}", request=request)
    return payment_service.serialize_payment_for_admin(payment)


@router.post("/admin/{payment_id}/reconcile")
def admin_reconcile_payment(
    payment_id: int,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    payment = payment_service.reconcile_payment(db, payment, force=True)
    return payment_service.serialize_payment_for_admin(payment)


@router.post("/admin/reconcile")
def admin_reconcile_all(
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Re-check open orders, pending refunds, and paid-but-not-enrolled payments against Razorpay."""
    return payment_service.reconcile_open_payments(db)
