"""
Course pricing — admins set live prices; instructors may only *suggest* a price that an
admin approves. All amounts are converted to minor units (paise) with Decimal.
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from models.course import Course
from models.payment import CoursePriceRequest, PriceRequestStatus, PricingType
from models.user import User
from utils.cache import cache_invalidate_prefix
from utils.money import MoneyError, normalize_currency, to_major_display, to_minor_units, validate_paid_amount


def resolve_amount(pricing_type: str, price: Optional[Decimal], currency: str) -> tuple[str, int, str]:
    """Validate a (type, price, currency) triple and return (type, amount_minor, currency)."""
    pricing_type = (pricing_type or "").upper()
    if pricing_type not in (PricingType.FREE.value, PricingType.PAID.value):
        raise MoneyError("Pricing type must be FREE or PAID")
    currency = normalize_currency(currency)
    if pricing_type == PricingType.FREE.value:
        return pricing_type, 0, currency
    if price is None:
        raise MoneyError("A paid course must have a price")
    amount = validate_paid_amount(to_minor_units(price, currency), currency)
    return pricing_type, amount, currency


def pricing_snapshot(course: Course) -> str:
    if (course.pricing_type or "FREE").upper() != PricingType.PAID.value:
        return "FREE"
    state = "" if course.is_purchasable else " (purchasing paused)"
    return f"PAID {course.currency} {int(course.price_amount or 0)}{state}"


def apply_pricing(db: Session, course: Course, pricing_type: str, amount: int, currency: str,
                  is_purchasable: bool = True) -> Course:
    course.pricing_type = pricing_type
    course.price_amount = amount
    course.currency = currency
    course.is_purchasable = bool(is_purchasable)
    course.price = to_major_display(amount, currency)  # display mirror only
    db.commit()
    db.refresh(course)
    cache_invalidate_prefix("courses")
    return course


def serialize_course_pricing(course: Course, pending_requests: int = 0) -> dict:
    return {
        "id": course.id,
        "title": course.title,
        "slug": course.slug,
        "instructor_name": course.instructor.full_name if course.instructor else "",
        "is_published": course.is_published,
        "is_approved": course.is_approved,
        "pricing_type": (course.pricing_type or "FREE").upper(),
        "price_amount": int(course.price_amount or 0),
        "currency": course.currency or "INR",
        "is_purchasable": bool(course.is_purchasable),
        "pending_price_requests": pending_requests,
    }


def serialize_price_request(r: CoursePriceRequest) -> dict:
    return {
        "id": r.id,
        "course_id": r.course_id,
        "course_title": r.course.title if r.course else None,
        "current_pricing_type": (r.course.pricing_type or "FREE").upper() if r.course else None,
        "current_price_amount": int(r.course.price_amount or 0) if r.course else None,
        "requested_by": r.requested_by,
        "requested_by_name": r.requester.full_name if r.requester else None,
        "pricing_type": r.pricing_type,
        "amount": r.amount,
        "currency": r.currency,
        "note": r.note,
        "status": r.status,
        "review_note": r.review_note,
        "reviewed_by_name": r.reviewer.full_name if r.reviewer else None,
        "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


def create_price_request(db: Session, course: Course, user: User, pricing_type: str, amount: int,
                         currency: str, note: Optional[str]) -> CoursePriceRequest:
    existing = (
        db.query(CoursePriceRequest)
        .filter(CoursePriceRequest.course_id == course.id,
                CoursePriceRequest.status == PriceRequestStatus.PENDING.value)
        .first()
    )
    if existing:
        raise MoneyError("This course already has a pending price request awaiting admin review")
    req = CoursePriceRequest(
        course_id=course.id,
        requested_by=user.id,
        pricing_type=pricing_type,
        amount=amount,
        currency=currency,
        note=(note or "").strip() or None,
        status=PriceRequestStatus.PENDING.value,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


def review_price_request(db: Session, req: CoursePriceRequest, admin: User, approve: bool,
                         review_note: Optional[str]) -> CoursePriceRequest:
    req.status = PriceRequestStatus.APPROVED.value if approve else PriceRequestStatus.REJECTED.value
    req.reviewed_by = admin.id
    req.review_note = (review_note or "").strip() or None
    req.reviewed_at = datetime.now(timezone.utc)
    if approve:
        # Re-validate at approval time; the stored request is never trusted blindly.
        pricing_type, amount, currency = req.pricing_type, int(req.amount or 0), req.currency
        if pricing_type == PricingType.PAID.value:
            validate_paid_amount(amount, normalize_currency(currency))
        else:
            amount = 0
        apply_pricing(db, req.course, pricing_type, amount, normalize_currency(currency),
                      is_purchasable=req.course.is_purchasable if req.course.is_purchasable is not None else True)
    else:
        db.commit()
    db.refresh(req)
    return req
