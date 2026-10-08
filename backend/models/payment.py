"""
Payment, PaymentEvent and CoursePriceRequest models.

Money is always stored as an integer in the currency's smallest unit (paise for INR).
Razorpay is the payment gateway; the backend database is the source of truth for
whether a learner has paid and been granted access.
"""

import enum
from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship

from database import Base


def _utcnow():
    return datetime.now(timezone.utc)


class PricingType(str, enum.Enum):
    FREE = "FREE"
    PAID = "PAID"


class PaymentStatus(str, enum.Enum):
    CREATED = "CREATED"      # Razorpay order created, no payment attempt seen yet
    PENDING = "PENDING"      # A payment attempt exists but is not confirmed captured yet
    SUCCESS = "SUCCESS"      # Captured and verified server-side
    FAILED = "FAILED"        # Latest attempt failed (a later retry on the same order may still succeed)
    REFUNDED = "REFUNDED"    # Fully refunded, confirmed by Razorpay


class RefundStatus(str, enum.Enum):
    REQUESTED = "requested"  # Local marker set before calling Razorpay (prevents double refunds)
    PENDING = "pending"
    PROCESSED = "processed"
    FAILED = "failed"


class PriceRequestStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (
        Index("ix_payments_user_course_status", "user_id", "course_id", "status"),
    )

    id = Column(Integer, primary_key=True, index=True)
    # SET NULL keeps the financial record even if the user or course is deleted.
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="SET NULL"), nullable=True, index=True)
    course_title = Column(String(300), nullable=True)  # Snapshot at purchase time

    razorpay_order_id = Column(String(64), unique=True, nullable=False, index=True)
    razorpay_payment_id = Column(String(64), unique=True, nullable=True, index=True)

    amount = Column(Integer, nullable=False)  # Smallest currency unit (paise)
    currency = Column(String(3), nullable=False, default="INR")
    status = Column(String(16), nullable=False, default=PaymentStatus.CREATED.value, index=True)
    payment_method = Column(String(32), nullable=True)
    failure_reason = Column(String(500), nullable=True)

    # How the success was established: checkout | webhook | reconcile
    verified_via = Column(String(16), nullable=True)
    paid_at = Column(DateTime, nullable=True)
    # Set once the enrollment has been granted. SUCCESS with fulfilled_at NULL means the
    # learner paid but access still needs to be granted — reconciliation retries these.
    fulfilled_at = Column(DateTime, nullable=True)
    enrollment_id = Column(Integer, nullable=True)
    fulfillment_error = Column(String(500), nullable=True)
    # Operational flag for admins (e.g. a duplicate purchase that should be refunded).
    admin_note = Column(String(255), nullable=True)

    refund_id = Column(String(64), nullable=True, unique=True)
    refund_status = Column(String(16), nullable=True)
    refunded_amount = Column(Integer, nullable=True)
    refunded_at = Column(DateTime, nullable=True)
    refunded_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    # Bumped only after Razorpay reports a refund as failed; part of the refund receipt
    # (idempotency key), so retries of the same attempt can never create a second refund.
    refund_attempt = Column(Integer, nullable=False, default=0, server_default="0")

    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)

    user = relationship("User", foreign_keys=[user_id])
    course = relationship("Course")

    def __repr__(self):
        return f"<Payment(id={self.id}, order='{self.razorpay_order_id}', status='{self.status}')>"


class PaymentEvent(Base):
    """
    Minimal, non-sensitive log of Razorpay webhook events.
    The unique event_id makes webhook processing idempotent.
    """
    __tablename__ = "payment_events"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(100), unique=True, nullable=False, index=True)
    event_type = Column(String(64), nullable=False)
    razorpay_order_id = Column(String(64), nullable=True, index=True)
    razorpay_payment_id = Column(String(64), nullable=True)
    # RECEIVED | PROCESSED | IGNORED | FAILED
    status = Column(String(16), nullable=False, default="RECEIVED")
    error = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    processed_at = Column(DateTime, nullable=True)


class CoursePriceRequest(Base):
    """An instructor's suggested price. It only becomes live when an admin approves it."""
    __tablename__ = "course_price_requests"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    requested_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    pricing_type = Column(String(10), nullable=False)
    amount = Column(Integer, nullable=False, default=0)  # Smallest currency unit
    currency = Column(String(3), nullable=False, default="INR")
    note = Column(String(1000), nullable=True)
    status = Column(String(16), nullable=False, default=PriceRequestStatus.PENDING.value, index=True)
    reviewed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    review_note = Column(String(1000), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    course = relationship("Course")
    requester = relationship("User", foreign_keys=[requested_by])
    reviewer = relationship("User", foreign_keys=[reviewed_by])
