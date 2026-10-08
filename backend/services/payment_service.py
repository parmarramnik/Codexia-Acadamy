"""
Payment service — the single place where money turns into course access.

Flow:  create_order -> Razorpay Checkout -> verify_checkout (signature + gateway fetch)
                                         -> webhook (signed) ------------------------┐
                                                                                     v
                                        fulfill_payment: Payment SUCCESS + Enrollment (idempotent)

Rules enforced here:
  * The amount always comes from the Course row in the database, never from the client.
  * A payment is only marked SUCCESS after Razorpay confirms it is captured for the exact
    order amount (via an authenticated API fetch or a signature-verified webhook).
  * Every state transition happens under a row lock (SELECT ... FOR UPDATE on PostgreSQL)
    and is idempotent, so duplicate callbacks, retries and webhooks are harmless.
  * If the enrollment cannot be created after a verified payment, the SUCCESS is still
    persisted with fulfilled_at = NULL and reconciliation retries the grant.
"""

import hashlib
import json
import logging
import re
import secrets
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from config import settings
from models.course import Course, Enrollment
from models.payment import Payment, PaymentEvent, PaymentIdempotencyKey, PaymentStatus, RefundStatus
from models.user import User
from services import razorpay_client as rzp
from utils.cache import cache_invalidate_prefix, invalidate_learner_cache
from utils.money import MoneyError, normalize_currency, validate_paid_amount

logger = logging.getLogger("codexia.payments")

ORDER_ID_RE = re.compile(r"^order_[A-Za-z0-9]{6,40}$")
PAYMENT_ID_RE = re.compile(r"^pay_[A-Za-z0-9]{6,40}$")
SIGNATURE_RE = re.compile(r"^[a-f0-9]{64}$")
IDEMPOTENCY_KEY_RE = re.compile(r"^[A-Za-z0-9_-]{16,64}$")

ORDER_REUSE_WINDOW = timedelta(hours=6)
PENDING_BLOCK_WINDOW = timedelta(minutes=15)
RECONCILE_MIN_INTERVAL_SECONDS = 10
IDEMPOTENCY_KEY_TTL = timedelta(hours=24)
# Longer than a worst-case create_order (reconcile fetch + order create, 15s Razorpay timeout each).
IDEMPOTENCY_IN_FLIGHT_TIMEOUT = timedelta(seconds=60)

OPEN_STATUSES = (PaymentStatus.CREATED.value, PaymentStatus.PENDING.value, PaymentStatus.FAILED.value)


class PaymentFlowError(Exception):
    """Business-rule failure with a user-safe message."""

    def __init__(self, message: str, status_code: int = 400, code: Optional[str] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code


# --------------------------------------------------------------------------- helpers

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def get_active_enrollment(db: Session, user_id: int, course_id: int) -> Optional[Enrollment]:
    return (
        db.query(Enrollment)
        .filter(Enrollment.user_id == user_id, Enrollment.course_id == course_id, Enrollment.is_active == True)
        .first()
    )


def _lock_payment(db: Session, payment_pk: int) -> Payment:
    """Re-read a payment row with a row lock (no-op on SQLite) and fresh attributes."""
    return (
        db.query(Payment)
        .filter(Payment.id == payment_pk)
        .populate_existing()
        .with_for_update()
        .one()
    )


# Per-process striped locks serialize order creation for the same (user, course), so a
# double click or two tabs reuse one Razorpay order instead of creating two.
_ORDER_LOCKS = [threading.Lock() for _ in range(64)]


def _order_lock(user_id: int, course_id: int) -> threading.Lock:
    return _ORDER_LOCKS[hash((user_id, course_id)) % len(_ORDER_LOCKS)]


_last_reconcile: dict[int, float] = {}


# --------------------------------------------------------------------------- order creation

def create_order(db: Session, user: User, course_id: int) -> tuple[Payment, Course]:
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise PaymentFlowError("Course not found", 404, "COURSE_NOT_FOUND")
    if not (course.is_published and course.is_approved):
        raise PaymentFlowError("This course is not available for purchase", 400, "COURSE_UNAVAILABLE")
    if not course.is_paid:
        raise PaymentFlowError("This course is free — enroll directly, no payment needed.", 400, "COURSE_FREE")
    if not course.is_purchasable:
        raise PaymentFlowError("Purchases for this course are currently paused.", 400, "PURCHASE_DISABLED")
    try:
        currency = normalize_currency(course.currency)
        amount = validate_paid_amount(int(course.price_amount or 0), currency)
    except (MoneyError, TypeError, ValueError):
        logger.error("Course %s has an invalid price configuration", course.id)
        raise PaymentFlowError("This course's price is not configured correctly. Please contact support.",
                               400, "INVALID_PRICE")
    if get_active_enrollment(db, user.id, course.id):
        raise PaymentFlowError("You are already enrolled in this course.", 409, "ALREADY_ENROLLED")
    paid = (
        db.query(Payment)
        .filter(Payment.user_id == user.id, Payment.course_id == course.id,
                Payment.status == PaymentStatus.SUCCESS.value)
        .first()
    )
    if paid:
        # Paid but access missing (enrollment grant failed or was deactivated): repair, never re-charge.
        paid = _lock_payment(db, paid.id)
        paid.fulfilled_at = None
        db.commit()
        fulfill_payment(db, paid, via="reconcile")
        raise PaymentFlowError("You have already purchased this course.", 409, "ALREADY_ENROLLED")

    with _order_lock(user.id, course.id):
        recent = (
            db.query(Payment)
            .filter(Payment.user_id == user.id, Payment.course_id == course.id, Payment.status.in_(OPEN_STATUSES))
            .order_by(Payment.created_at.desc(), Payment.id.desc())
            .first()
        )
        if recent:
            if recent.status == PaymentStatus.PENDING.value:
                recent = reconcile_payment(db, recent, force=True)
                if recent.status == PaymentStatus.SUCCESS.value:
                    raise PaymentFlowError("Your payment was successful — you are already enrolled.", 409,
                                           "ALREADY_ENROLLED")
                if (recent.status == PaymentStatus.PENDING.value
                        and _now() - _as_utc(recent.updated_at) < PENDING_BLOCK_WINDOW):
                    raise PaymentFlowError(
                        "A payment for this course is already being processed. Please wait a moment and refresh.",
                        409, "PAYMENT_IN_PROGRESS")
            elif (recent.amount == amount and recent.currency == currency
                  and _now() - _as_utc(recent.created_at) < ORDER_REUSE_WINDOW):
                # Same price, still fresh: reuse the order (Razorpay allows retries on one order).
                if recent.status == PaymentStatus.FAILED.value:
                    recent.status = PaymentStatus.CREATED.value
                    db.commit()
                    db.refresh(recent)
                return recent, course

        if not settings.payments_configured:
            raise PaymentFlowError("Online payments are temporarily unavailable.", 503, "NOT_CONFIGURED")

        receipt = f"c{course.id}u{user.id}-{secrets.token_hex(4)}"
        try:
            order = rzp.create_order(amount, currency, receipt,
                                     notes={"course_id": str(course.id), "user_id": str(user.id)})
        except rzp.RazorpayError as exc:
            raise PaymentFlowError(exc.message, exc.status_code, exc.code or "GATEWAY_ERROR")

        order_id = str(order.get("id") or "")
        if (not ORDER_ID_RE.match(order_id) or order.get("amount") != amount
                or str(order.get("currency", "")).upper() != currency):
            logger.error("Unexpected Razorpay order response for course %s", course.id)
            raise PaymentFlowError("Payment gateway error. Please try again.", 502, "GATEWAY_ERROR")

        payment = Payment(
            user_id=user.id,
            course_id=course.id,
            course_title=course.title,
            razorpay_order_id=order_id,
            amount=amount,
            currency=currency,
            status=PaymentStatus.CREATED.value,
        )
        db.add(payment)
        db.commit()
        db.refresh(payment)
        logger.info("Created Razorpay order %s (payment #%s) for user %s course %s",
                    order_id, payment.id, user.id, course.id)
        return payment, course


# --------------------------------------------------------------------------- idempotency keys

def create_order_idempotent(db: Session, user: User, course_id: int, key: str) -> tuple[Payment, Course]:
    """
    create_order keyed by the client's Idempotency-Key. A retry with the same key gets the
    order the first attempt created, even if that attempt's response was lost. Once that order
    is paid (or in flight), the key falls back to create_order's checks, so it can never hand
    out an order for a second payment.
    """
    if not IDEMPOTENCY_KEY_RE.match(key or ""):
        raise PaymentFlowError("Invalid Idempotency-Key header", 400, "INVALID_IDEMPOTENCY_KEY")
    record = _claim_idempotency_key(db, user.id, key, order_request_hash(course_id))
    record_pk = record.id

    if record.payment_id:
        payment = db.query(Payment).filter(Payment.id == record.payment_id).first()
        if payment and payment.status in (PaymentStatus.CREATED.value, PaymentStatus.FAILED.value):
            course = db.query(Course).filter(Course.id == payment.course_id).first()
            if course:
                logger.info("Idempotent replay of order %s for user %s", payment.razorpay_order_id, user.id)
                return payment, course

    try:
        payment, course = create_order(db, user, course_id)
    except Exception:
        db.rollback()
        _release_idempotency_key(db, record_pk)
        raise

    record = db.query(PaymentIdempotencyKey).filter(PaymentIdempotencyKey.id == record_pk).one()
    record.payment_id = payment.id
    db.commit()
    return payment, course


def order_request_hash(course_id: int) -> str:
    return hashlib.sha256(f"create_order:{course_id}".encode("utf-8")).hexdigest()


def _claim_idempotency_key(db: Session, user_id: int, key: str, request_hash: str) -> PaymentIdempotencyKey:
    """Insert the key's row, or return it if an earlier request with this key already finished."""
    in_progress = PaymentFlowError("Your checkout is still being set up. Please try again in a moment.",
                                   409, "REQUEST_IN_PROGRESS")
    for _ in range(3):
        record = (db.query(PaymentIdempotencyKey)
                  .filter(PaymentIdempotencyKey.user_id == user_id, PaymentIdempotencyKey.key == key)
                  .first())
        if record is None:
            # The user's expired keys are pruned here so the table stays small without a cron job.
            cutoff = (_now() - IDEMPOTENCY_KEY_TTL).replace(tzinfo=None)
            (db.query(PaymentIdempotencyKey)
             .filter(PaymentIdempotencyKey.user_id == user_id, PaymentIdempotencyKey.created_at < cutoff)
             .delete(synchronize_session=False))
            record = PaymentIdempotencyKey(user_id=user_id, key=key, request_hash=request_hash)
            db.add(record)
            try:
                db.commit()
                return record
            except IntegrityError:
                db.rollback()  # A concurrent request with the same key inserted first
                continue

        age = _now() - _as_utc(record.created_at)
        if age > IDEMPOTENCY_KEY_TTL:
            db.query(PaymentIdempotencyKey).filter(PaymentIdempotencyKey.id == record.id).delete(
                synchronize_session=False)
            db.commit()
            continue
        if record.request_hash != request_hash:
            raise PaymentFlowError("This Idempotency-Key was already used for a different request.",
                                   422, "IDEMPOTENCY_KEY_REUSED")
        if record.payment_id is not None:
            return record
        if age < IDEMPOTENCY_IN_FLIGHT_TIMEOUT:
            raise in_progress

        # The request holding this key died mid-way. Take it over; comparing created_at
        # makes sure only one of several concurrent retries wins.
        taken = (db.query(PaymentIdempotencyKey)
                 .filter(PaymentIdempotencyKey.id == record.id,
                         PaymentIdempotencyKey.created_at == record.created_at,
                         PaymentIdempotencyKey.payment_id == None)
                 .update({PaymentIdempotencyKey.created_at: _now()}, synchronize_session=False))
        db.commit()
        if taken:
            db.refresh(record)
            return record
    raise in_progress


def _release_idempotency_key(db: Session, record_pk: int) -> None:
    """The keyed request failed before creating an order: free the key so a retry runs again."""
    try:
        (db.query(PaymentIdempotencyKey)
         .filter(PaymentIdempotencyKey.id == record_pk, PaymentIdempotencyKey.payment_id == None)
         .delete(synchronize_session=False))
        db.commit()
    except Exception:
        db.rollback()  # Left in flight, the key is taken over after IDEMPOTENCY_IN_FLIGHT_TIMEOUT


# --------------------------------------------------------------------------- fulfillment

def _grant_enrollment(db: Session, user_id: Optional[int], course_id: Optional[int]) -> Enrollment:
    if user_id is None or course_id is None:
        raise RuntimeError("payment is no longer linked to a user or course")
    enrollment = db.query(Enrollment).filter(Enrollment.user_id == user_id, Enrollment.course_id == course_id).first()
    if enrollment:
        if not enrollment.is_active:
            enrollment.is_active = True
    else:
        enrollment = Enrollment(user_id=user_id, course_id=course_id, is_active=True, completion_percentage=0.0)
        db.add(enrollment)
    db.flush()
    return enrollment


def _mark_success_fields(payment: Payment, razorpay_payment_id: Optional[str], method: Optional[str], via: str):
    payment.status = PaymentStatus.SUCCESS.value
    if razorpay_payment_id:
        payment.razorpay_payment_id = razorpay_payment_id
    if method:
        payment.payment_method = str(method)[:32]
    payment.verified_via = payment.verified_via or via
    payment.paid_at = payment.paid_at or _now()
    payment.failure_reason = None


def fulfill_payment(db: Session, payment: Payment, razorpay_payment_id: Optional[str] = None,
                    method: Optional[str] = None, via: str = "checkout") -> Payment:
    """Mark a gateway-confirmed payment SUCCESS and grant the enrollment. Idempotent."""
    payment_pk = payment.id
    for attempt in range(2):
        payment = _lock_payment(db, payment_pk)
        if payment.status == PaymentStatus.REFUNDED.value:
            db.commit()
            return payment
        if payment.status == PaymentStatus.SUCCESS.value and payment.fulfilled_at:
            if razorpay_payment_id and payment.razorpay_payment_id not in (None, razorpay_payment_id):
                logger.critical("Order %s received a second captured payment %s — review and refund manually",
                                payment.razorpay_order_id, razorpay_payment_id)
            db.commit()
            return payment

        newly_succeeded = payment.status != PaymentStatus.SUCCESS.value
        _mark_success_fields(payment, razorpay_payment_id, method, via)
        try:
            enrollment = _grant_enrollment(db, payment.user_id, payment.course_id)
            payment.enrollment_id = enrollment.id
            payment.fulfilled_at = _now()
            payment.fulfillment_error = None
            _flag_duplicate_purchase(db, payment)
            db.commit()
        except IntegrityError:
            # A concurrent request created the enrollment first — retry; it will now be found.
            db.rollback()
            if attempt == 0:
                continue
            return _persist_unfulfilled_success(db, payment_pk, razorpay_payment_id, method, via)
        except Exception as exc:
            db.rollback()
            logger.error("Enrollment grant failed for payment #%s: %s", payment_pk, type(exc).__name__)
            return _persist_unfulfilled_success(db, payment_pk, razorpay_payment_id, method, via)

        logger.info("Payment #%s SUCCESS via %s — enrollment #%s granted", payment.id, via, payment.enrollment_id)
        _after_access_granted(db, payment, notify=newly_succeeded)
        return payment
    return payment


def _flag_duplicate_purchase(db: Session, payment: Payment) -> None:
    """Two separate orders both captured for the same learner + course: keep both records, flag for refund."""
    earlier = (
        db.query(Payment)
        .filter(Payment.user_id == payment.user_id, Payment.course_id == payment.course_id,
                Payment.id != payment.id, Payment.status == PaymentStatus.SUCCESS.value)
        .order_by(Payment.id.asc())
        .first()
    )
    if earlier and earlier.id < payment.id:
        payment.admin_note = f"Duplicate purchase: already paid via order {earlier.razorpay_order_id}. Refund this payment."
        logger.warning("Duplicate purchase on payment #%s (earlier #%s) — flagged for refund", payment.id, earlier.id)


def _persist_unfulfilled_success(db: Session, payment_pk: int, razorpay_payment_id, method, via) -> Payment:
    """Never lose a verified payment: record SUCCESS without access so reconciliation can retry."""
    payment = _lock_payment(db, payment_pk)
    if payment.status != PaymentStatus.REFUNDED.value:
        _mark_success_fields(payment, razorpay_payment_id, method, via)
        payment.fulfillment_error = "Course access could not be granted yet; it will be retried automatically."
    db.commit()
    logger.error("Payment #%s recorded as SUCCESS but enrollment is pending reconciliation", payment_pk)
    return payment


def _after_access_granted(db: Session, payment: Payment, notify: bool) -> None:
    try:
        invalidate_learner_cache(payment.user_id)
        cache_invalidate_prefix("courses")
    except Exception:
        pass
    if not notify:
        return
    try:
        from services import analytics_service
        course = db.query(Course).filter(Course.id == payment.course_id).first()
        if course:
            analytics_service.create_notification(
                db=db,
                user_id=payment.user_id,
                title=f"Enrolled in {course.title}",
                message=f"Your payment was successful. You now have full access to '{course.title}'.",
                notification_type="course_update",
                link=f"/courses/{course.slug}",
            )
    except Exception:
        db.rollback()


def mark_pending(db: Session, payment: Payment, razorpay_payment_id: Optional[str] = None,
                 method: Optional[str] = None) -> Payment:
    payment = _lock_payment(db, payment.id)
    if payment.status in (PaymentStatus.CREATED.value, PaymentStatus.FAILED.value, PaymentStatus.PENDING.value):
        payment.status = PaymentStatus.PENDING.value
        if razorpay_payment_id:
            payment.razorpay_payment_id = razorpay_payment_id
        if method:
            payment.payment_method = str(method)[:32]
    db.commit()
    return payment


def mark_failed(db: Session, payment: Payment, razorpay_payment_id: Optional[str] = None,
                method: Optional[str] = None, reason: Optional[str] = None) -> Payment:
    payment = _lock_payment(db, payment.id)
    # A failed attempt never downgrades a confirmed payment.
    if payment.status in (PaymentStatus.CREATED.value, PaymentStatus.PENDING.value, PaymentStatus.FAILED.value):
        payment.status = PaymentStatus.FAILED.value
        if razorpay_payment_id:
            payment.razorpay_payment_id = razorpay_payment_id
        if method:
            payment.payment_method = str(method)[:32]
        payment.failure_reason = (reason or "Payment failed")[:500]
    db.commit()
    return payment


def _record_refunded_before_fulfillment(db: Session, payment: Payment, pay_id: str, method: Optional[str],
                                        amount_ok: bool) -> Payment:
    payment = _lock_payment(db, payment.id)
    if payment.status in OPEN_STATUSES:
        payment.status = PaymentStatus.REFUNDED.value
        payment.razorpay_payment_id = pay_id
        if method:
            payment.payment_method = str(method)[:32]
        payment.refund_status = RefundStatus.PROCESSED.value
        payment.refunded_amount = payment.amount if amount_ok else None
        payment.refunded_at = payment.refunded_at or _now()
        payment.failure_reason = None
    db.commit()
    return payment


def apply_gateway_payment(db: Session, payment: Payment, entity: dict, via: str) -> Payment:
    """Apply a Razorpay payment entity (from an API fetch or a verified webhook) to our record."""
    pay_id = str(entity.get("id") or "")
    if entity.get("order_id") != payment.razorpay_order_id or not PAYMENT_ID_RE.match(pay_id):
        logger.error("Gateway payment does not belong to order %s", payment.razorpay_order_id)
        return payment

    status = entity.get("status")
    method = entity.get("method")
    amount_ok = entity.get("amount") == payment.amount and str(entity.get("currency", "")).upper() == payment.currency

    # Webhooks can arrive out of order: a late "authorized"/"failed" event for a payment that is
    # already final must be a no-op (and must not trigger another capture call).
    if payment.status in (PaymentStatus.SUCCESS.value, PaymentStatus.REFUNDED.value) and status != "captured":
        return payment

    if status == "refunded":
        # Fully refunded before we ever confirmed it (e.g. refunded from the Razorpay dashboard):
        # record the money trail but never grant access for it.
        return _record_refunded_before_fulfillment(db, payment, pay_id, method, amount_ok)

    if status == "captured":
        if not amount_ok:
            logger.critical("Amount mismatch on order %s (payment %s) — access NOT granted",
                            payment.razorpay_order_id, pay_id)
            payment = mark_pending(db, payment, pay_id, method)
            payment.failure_reason = "Amount mismatch — under manual review"
            db.commit()
            return payment
        return fulfill_payment(db, payment, pay_id, method, via)

    if status == "authorized":
        if not amount_ok:
            logger.critical("Amount mismatch on authorized payment %s — not capturing", pay_id)
            return mark_pending(db, payment, pay_id, method)
        try:
            captured = rzp.capture_payment(pay_id, payment.amount, payment.currency)
            if captured.get("status") == "captured":
                return fulfill_payment(db, payment, pay_id, method, via)
        except rzp.RazorpayError:
            pass  # Already captured elsewhere or transient — the captured webhook/reconcile will finish it.
        return mark_pending(db, payment, pay_id, method)

    if status == "failed":
        return mark_failed(db, payment, pay_id, method, entity.get("error_description"))

    return mark_pending(db, payment, pay_id, method)


# --------------------------------------------------------------------------- checkout verification

def verify_checkout(db: Session, user: User, order_id: str, payment_id: str, signature: str) -> Payment:
    if not (ORDER_ID_RE.match(order_id or "") and PAYMENT_ID_RE.match(payment_id or "")
            and SIGNATURE_RE.match(signature or "")):
        raise PaymentFlowError("Invalid payment details", 400, "INVALID_INPUT")

    payment = db.query(Payment).filter(Payment.razorpay_order_id == order_id, Payment.user_id == user.id).first()
    if not payment:
        raise PaymentFlowError("Payment not found", 404, "PAYMENT_NOT_FOUND")

    if not rzp.verify_payment_signature(order_id, payment_id, signature):
        logger.warning("Invalid checkout signature for order %s by user %s", order_id, user.id)
        try:
            from services.audit_service import log_security_event
            log_security_event(db, user.id, "payment_signature_invalid", details=f"order={order_id}")
        except Exception:
            db.rollback()
        raise PaymentFlowError(
            "Payment verification failed. No course access was granted. If money was deducted, "
            "it will be confirmed automatically or refunded by your bank.", 400, "SIGNATURE_INVALID")

    if payment.status == PaymentStatus.SUCCESS.value:
        return payment if payment.fulfilled_at else fulfill_payment(db, payment, via="checkout")
    if payment.status == PaymentStatus.REFUNDED.value:
        return payment

    # Signature is authentic; confirm capture + amount with Razorpay before granting access.
    try:
        entity = rzp.fetch_payment(payment_id)
    except rzp.RazorpayError:
        # Leave it PENDING — the webhook or status polling will complete it.
        return mark_pending(db, payment, payment_id)
    return apply_gateway_payment(db, payment, entity, via="checkout")


# --------------------------------------------------------------------------- reconciliation

def reconcile_payment(db: Session, payment: Payment, force: bool = False) -> Payment:
    """Bring a local payment in line with Razorpay. Safe to call any number of times."""
    if payment.status == PaymentStatus.SUCCESS.value and not payment.fulfilled_at:
        return fulfill_payment(db, payment, via="reconcile")

    refund_open = payment.refund_status in (RefundStatus.PENDING.value, RefundStatus.REQUESTED.value)
    needs_gateway = payment.status in OPEN_STATUSES or refund_open
    if not needs_gateway or not settings.payments_configured:
        return payment

    now = time.monotonic()
    if not force and now - _last_reconcile.get(payment.id, 0) < RECONCILE_MIN_INTERVAL_SECONDS:
        return payment
    _last_reconcile[payment.id] = now

    try:
        if payment.status in OPEN_STATUSES:
            items = rzp.fetch_order_payments(payment.razorpay_order_id)
            by_status = {}
            for item in items:
                by_status.setdefault(item.get("status"), item)
            chosen = by_status.get("captured") or by_status.get("refunded") or by_status.get("authorized")
            if chosen:
                return apply_gateway_payment(db, payment, chosen, via="reconcile")
            if by_status.get("failed") and payment.status != PaymentStatus.FAILED.value:
                return apply_gateway_payment(db, payment, by_status["failed"], via="reconcile")
        elif payment.refund_id:
            refund = rzp.fetch_refund(payment.refund_id)
            payment = _lock_payment(db, payment.id)
            _apply_refund(db, payment, refund)
            db.commit()
        elif payment.razorpay_payment_id:
            # REQUESTED marker without a refund id: the create call's outcome was never recorded.
            synced = _sync_refund_from_gateway(db, payment.id)
            if synced is not None:
                return synced
            payment = _lock_payment(db, payment.id)
            if payment.refund_status == RefundStatus.REQUESTED.value and not payment.refund_id:
                payment.refund_status = None  # Nothing reached Razorpay; the admin may retry safely
            db.commit()
    except rzp.RazorpayError:
        pass
    return payment


def reconcile_open_payments(db: Session, days: int = 7, limit: int = 100) -> dict:
    cutoff = (_now() - timedelta(days=days)).replace(tzinfo=None)
    candidates = (
        db.query(Payment)
        .filter(or_(
            Payment.status.in_((PaymentStatus.CREATED.value, PaymentStatus.PENDING.value)) & (Payment.created_at >= cutoff),
            (Payment.status == PaymentStatus.SUCCESS.value) & (Payment.fulfilled_at == None),
            Payment.refund_status.in_((RefundStatus.PENDING.value, RefundStatus.REQUESTED.value)),
        ))
        .order_by(Payment.created_at.desc())
        .limit(limit)
        .all()
    )
    changed = 0
    for p in candidates:
        before = (p.status, p.fulfilled_at, p.refund_status)
        try:
            p = reconcile_payment(db, p, force=True)
        except Exception as exc:
            db.rollback()
            logger.error("Reconcile failed for payment #%s: %s", p.id, type(exc).__name__)
            continue
        if (p.status, p.fulfilled_at, p.refund_status) != before:
            changed += 1
    return {"checked": len(candidates), "updated": changed}


# --------------------------------------------------------------------------- refunds

def _apply_refund(db: Session, payment: Payment, refund: dict) -> None:
    refund_id = str(refund.get("id") or "")[:64] or None
    if payment.refund_id and refund_id and refund_id != payment.refund_id:
        return  # Event for an older, superseded refund attempt
    if refund_id and not payment.refund_id:
        payment.refund_id = refund_id
    status = refund.get("status")
    if status == "processed":
        payment.refund_status = RefundStatus.PROCESSED.value
        payment.refunded_amount = int(refund.get("amount") or 0)
        if payment.refunded_amount >= payment.amount and payment.status != PaymentStatus.REFUNDED.value:
            payment.status = PaymentStatus.REFUNDED.value
            payment.refunded_at = _now()
            _revoke_access_if_unpaid(db, payment)
    elif status == "failed":
        payment.refund_status = RefundStatus.FAILED.value
    elif payment.refund_status != RefundStatus.PROCESSED.value:
        payment.refund_status = RefundStatus.PENDING.value


def _revoke_access_if_unpaid(db: Session, payment: Payment) -> None:
    other_paid = (
        db.query(Payment)
        .filter(Payment.user_id == payment.user_id, Payment.course_id == payment.course_id,
                Payment.id != payment.id, Payment.status == PaymentStatus.SUCCESS.value)
        .first()
    )
    if other_paid:
        return
    enrollment = (
        db.query(Enrollment)
        .filter(Enrollment.user_id == payment.user_id, Enrollment.course_id == payment.course_id)
        .first()
    )
    if enrollment:
        enrollment.is_active = False
        try:
            invalidate_learner_cache(payment.user_id)
        except Exception:
            pass


def refund_receipt(payment: Payment) -> str:
    return f"rfnd_p{payment.id}_{int(payment.refund_attempt or 0)}"


def _sync_refund_from_gateway(db: Session, payment_pk: int) -> Optional[Payment]:
    """Find the refund Razorpay already holds for our current receipt and apply it (None if none exists)."""
    payment = db.query(Payment).filter(Payment.id == payment_pk).one()
    receipt = refund_receipt(payment)
    refunds = rzp.fetch_payment_refunds(payment.razorpay_payment_id)
    match = next((r for r in refunds if r.get("receipt") == receipt), None)
    if not match:
        return None
    payment = _lock_payment(db, payment_pk)
    _apply_refund(db, payment, match)
    db.commit()
    return payment


def refund_payment(db: Session, payment_pk: int, admin: User, reason: Optional[str] = None) -> Payment:
    payment = _lock_payment(db, payment_pk)
    if payment.status != PaymentStatus.SUCCESS.value or not payment.razorpay_payment_id:
        db.commit()
        raise PaymentFlowError("Only successful payments can be refunded", 400, "NOT_REFUNDABLE")
    if payment.refund_status in (RefundStatus.REQUESTED.value, RefundStatus.PENDING.value,
                                 RefundStatus.PROCESSED.value):
        db.commit()
        raise PaymentFlowError("A refund for this payment is already in progress", 409, "REFUND_IN_PROGRESS")
    if payment.refund_status == RefundStatus.FAILED.value:
        # Razorpay confirmed the previous attempt failed: a new attempt gets a new receipt.
        payment.refund_attempt = int(payment.refund_attempt or 0) + 1
        payment.refund_id = None
    # Commit the marker before calling Razorpay so a double click cannot issue two refunds.
    payment.refund_status = RefundStatus.REQUESTED.value
    payment.refunded_by = admin.id
    db.commit()

    try:
        refund = rzp.create_refund(payment.razorpay_payment_id, payment.amount, refund_receipt(payment),
                                   notes={"reason": (reason or "Admin refund")[:200], "payment_ref": str(payment.id)})
    except rzp.RazorpayError as exc:
        # The request may have reached Razorpay (timeout, duplicate receipt). Look before giving up;
        # retrying later is still safe because the receipt stays the same for this attempt.
        try:
            synced = _sync_refund_from_gateway(db, payment_pk)
        except rzp.RazorpayError:
            synced = None
        if synced is not None:
            return synced
        payment = _lock_payment(db, payment_pk)
        payment.refund_status = None
        db.commit()
        raise PaymentFlowError(exc.message if exc.status_code != 400 else
                               "Razorpay rejected the refund. Check the payment in the Razorpay dashboard.",
                               exc.status_code, exc.code or "GATEWAY_ERROR")

    payment = _lock_payment(db, payment_pk)
    _apply_refund(db, payment, refund)
    db.commit()
    logger.info("Refund %s for payment #%s requested by admin %s (status=%s)",
                payment.refund_id, payment.id, admin.id, payment.refund_status)
    return payment


# --------------------------------------------------------------------------- webhooks

def _event_key(event_id_header: Optional[str], raw_body: bytes) -> str:
    event_id = (event_id_header or "").strip()
    if event_id:
        return event_id[:100]
    return "sha256:" + hashlib.sha256(raw_body).hexdigest()


def handle_webhook(db: Session, raw_body: bytes, event_id_header: Optional[str]) -> dict:
    """Process a webhook whose signature has ALREADY been verified by the caller."""
    try:
        payload = json.loads(raw_body)
        if not isinstance(payload, dict):
            raise ValueError
    except ValueError:
        raise PaymentFlowError("Malformed webhook payload", 400, "MALFORMED")

    event_type = str(payload.get("event") or "")[:64]
    body = payload.get("payload") or {}
    pay_entity = ((body.get("payment") or {}).get("entity")) or {}
    order_entity = ((body.get("order") or {}).get("entity")) or {}
    refund_entity = ((body.get("refund") or {}).get("entity")) or {}
    order_id = pay_entity.get("order_id") or order_entity.get("id")
    pay_id = pay_entity.get("id") or refund_entity.get("payment_id")
    key = _event_key(event_id_header, raw_body)

    event = db.query(PaymentEvent).filter(PaymentEvent.event_id == key).first()
    if event and event.status in ("PROCESSED", "IGNORED"):
        return {"status": "duplicate"}
    if not event:
        event = PaymentEvent(event_id=key, event_type=event_type or "unknown",
                             razorpay_order_id=(str(order_id)[:64] if order_id else None),
                             razorpay_payment_id=(str(pay_id)[:64] if pay_id else None),
                             status="RECEIVED")
        db.add(event)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            return {"status": "duplicate"}
    event_pk = event.id

    try:
        outcome = _dispatch_event(db, event_type, order_id, pay_entity, refund_entity)
    except Exception as exc:
        db.rollback()
        event = db.query(PaymentEvent).filter(PaymentEvent.id == event_pk).one()
        event.status = "FAILED"
        event.error = type(exc).__name__[:500]
        db.commit()
        raise

    event = db.query(PaymentEvent).filter(PaymentEvent.id == event_pk).one()
    event.status = outcome
    event.error = None
    event.processed_at = _now()
    db.commit()
    return {"status": outcome.lower()}


def _dispatch_event(db: Session, event_type: str, order_id, pay_entity: dict, refund_entity: dict) -> str:
    if event_type in ("payment.captured", "payment.authorized", "payment.failed", "order.paid"):
        if not order_id or not pay_entity:
            return "IGNORED"
        payment = db.query(Payment).filter(Payment.razorpay_order_id == str(order_id)).first()
        if not payment:
            return "IGNORED"  # Not an order created by this application
        apply_gateway_payment(db, payment, pay_entity, via="webhook")
        return "PROCESSED"

    if event_type in ("refund.created", "refund.processed", "refund.failed"):
        refund_pay_id = refund_entity.get("payment_id")
        if not refund_pay_id:
            return "IGNORED"
        payment = db.query(Payment).filter(Payment.razorpay_payment_id == str(refund_pay_id)).first()
        if not payment:
            return "IGNORED"
        payment = _lock_payment(db, payment.id)
        _apply_refund(db, payment, refund_entity)
        db.commit()
        return "PROCESSED"

    return "IGNORED"


# --------------------------------------------------------------------------- read models

def latest_payment_for(db: Session, user_id: int, course_id: int) -> Optional[Payment]:
    return (
        db.query(Payment)
        .filter(Payment.user_id == user_id, Payment.course_id == course_id)
        .order_by(Payment.created_at.desc(), Payment.id.desc())
        .first()
    )


def course_purchase_state(db: Session, user: User, course: Course) -> dict:
    """What the course page needs: is the learner enrolled, and what is their latest payment doing."""
    enrolled = get_active_enrollment(db, user.id, course.id) is not None
    latest = latest_payment_for(db, user.id, course.id)
    if latest and not enrolled and (
        latest.status in (PaymentStatus.CREATED.value, PaymentStatus.PENDING.value)
        or (latest.status == PaymentStatus.SUCCESS.value and not latest.fulfilled_at)
    ):
        # Covers "paid, then closed the browser before the callback" when the webhook is late.
        latest = reconcile_payment(db, latest)
        enrolled = get_active_enrollment(db, user.id, course.id) is not None
    return {
        "course_id": course.id,
        "pricing_type": (course.pricing_type or "FREE").upper(),
        "price_amount": int(course.price_amount or 0),
        "currency": course.currency or "INR",
        "is_purchasable": bool(course.is_purchasable),
        "enrolled": enrolled,
        "latest_payment": serialize_payment_for_user(latest, enrolled) if latest else None,
    }


def serialize_payment_for_user(p: Payment, enrolled: Optional[bool] = None) -> dict:
    return {
        "order_id": p.razorpay_order_id,
        "status": p.status,
        "amount": p.amount,
        "currency": p.currency,
        "course_id": p.course_id,
        "course_slug": p.course.slug if p.course else None,
        "course_title": p.course_title or (p.course.title if p.course else None),
        "enrolled": enrolled if enrolled is not None else bool(p.fulfilled_at and p.status == PaymentStatus.SUCCESS.value),
        "access_pending": p.status == PaymentStatus.SUCCESS.value and not p.fulfilled_at,
        "failure_reason": p.failure_reason if p.status in (PaymentStatus.FAILED.value, PaymentStatus.PENDING.value) else None,
        "paid_at": p.paid_at.isoformat() if p.paid_at else None,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


def serialize_payment_for_admin(p: Payment) -> dict:
    return {
        "id": p.id,
        "razorpay_order_id": p.razorpay_order_id,
        "razorpay_payment_id": p.razorpay_payment_id,
        "user_id": p.user_id,
        "student_name": p.user.full_name if p.user else None,
        "student_email": p.user.email if p.user else None,
        "course_id": p.course_id,
        "course_title": p.course_title or (p.course.title if p.course else None),
        "amount": p.amount,
        "currency": p.currency,
        "status": p.status,
        "payment_method": p.payment_method,
        "failure_reason": p.failure_reason,
        "verified_via": p.verified_via,
        "access_granted": bool(p.fulfilled_at) and p.status == PaymentStatus.SUCCESS.value,
        "fulfillment_error": p.fulfillment_error,
        "admin_note": p.admin_note,
        "refund_id": p.refund_id,
        "refund_status": p.refund_status,
        "refunded_amount": p.refunded_amount,
        "paid_at": p.paid_at.isoformat() if p.paid_at else None,
        "refunded_at": p.refunded_at.isoformat() if p.refunded_at else None,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


def admin_list_payments(db: Session, status: Optional[str], search: Optional[str], page: int, page_size: int) -> dict:
    query = db.query(Payment).outerjoin(User, Payment.user_id == User.id)
    if status:
        query = query.filter(Payment.status == status.upper())
    if search:
        term = f"%{search.strip()}%"
        query = query.filter(or_(
            Payment.razorpay_order_id.ilike(term),
            Payment.razorpay_payment_id.ilike(term),
            Payment.course_title.ilike(term),
            User.email.ilike(term),
            User.full_name.ilike(term),
        ))
    total = query.count()
    rows = (query.order_by(Payment.created_at.desc(), Payment.id.desc())
            .offset((page - 1) * page_size).limit(page_size).all())
    return {"items": [serialize_payment_for_admin(p) for p in rows], "total": total,
            "page": page, "page_size": page_size}


def admin_summary(db: Session) -> dict:
    counts = dict(db.query(Payment.status, func.count(Payment.id)).group_by(Payment.status).all())
    revenue = (db.query(func.coalesce(func.sum(Payment.amount), 0))
               .filter(Payment.status == PaymentStatus.SUCCESS.value, Payment.currency == "INR").scalar())
    unfulfilled = db.query(Payment).filter(Payment.status == PaymentStatus.SUCCESS.value,
                                           Payment.fulfilled_at == None).count()
    return {
        "counts": {s.value: int(counts.get(s.value, 0)) for s in PaymentStatus},
        "revenue": {"amount": int(revenue or 0), "currency": "INR"},
        "access_pending": unfulfilled,
        "gateway_configured": settings.payments_configured,
        "webhook_configured": bool(settings.RAZORPAY_WEBHOOK_SECRET),
        "mode": ("live" if (settings.RAZORPAY_KEY_ID or "").startswith("rzp_live_") else "test")
        if settings.RAZORPAY_KEY_ID else None,
    }
