"""
Pricing routes.

  Admin       -> sets live course pricing directly, reviews instructor price requests.
  Instructor  -> may only *suggest* a price for their own course; it is never live until approved.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from auth.permissions import require_role, is_owner_or_admin
from database import get_db
from models.course import Course
from models.payment import CoursePriceRequest, PriceRequestStatus
from models.user import User, UserRole
from schemas.payment import CoursePricingUpdate, PriceRequestCreate, PriceRequestReview
from services import pricing_service
from services.audit_service import log_audit_event

router = APIRouter()


# --------------------------------------------------------------------------- instructor

@router.post("/requests")
def submit_price_request(
    data: PriceRequestCreate,
    request: Request,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Suggest a price for a course you own. An admin must approve it before it goes live."""
    course = db.query(Course).filter(Course.id == data.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if not is_owner_or_admin(course.instructor_id, current_user):
        raise HTTPException(status_code=403, detail="You can only request pricing for your own courses")
    pricing_type, amount, currency = pricing_service.resolve_amount(data.pricing_type, data.price, data.currency)
    req = pricing_service.create_price_request(db, course, current_user, pricing_type, amount, currency, data.note)
    log_audit_event(db, current_user.id, "request_course_price", "course", str(course.id),
                    previous_value=pricing_service.pricing_snapshot(course),
                    new_value=f"{pricing_type} {currency} {amount}", request=request)
    return pricing_service.serialize_price_request(req)


@router.get("/requests/mine")
def list_my_price_requests(
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(CoursePriceRequest)
        .options(joinedload(CoursePriceRequest.course))
        .filter(CoursePriceRequest.requested_by == current_user.id)
        .order_by(CoursePriceRequest.created_at.desc())
        .limit(100)
        .all()
    )
    return [pricing_service.serialize_price_request(r) for r in rows]


# --------------------------------------------------------------------------- admin

@router.get("/admin/courses")
def admin_list_course_pricing(
    search: Optional[str] = Query(None, max_length=100),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    query = db.query(Course).options(joinedload(Course.instructor))
    if search:
        query = query.filter(Course.title.ilike(f"%{search.strip()}%"))
    courses = query.order_by(Course.title.asc()).limit(500).all()
    pending = dict(
        db.query(CoursePriceRequest.course_id, func.count(CoursePriceRequest.id))
        .filter(CoursePriceRequest.status == PriceRequestStatus.PENDING.value)
        .group_by(CoursePriceRequest.course_id)
        .all()
    )
    return [pricing_service.serialize_course_pricing(c, int(pending.get(c.id, 0))) for c in courses]


@router.put("/admin/courses/{course_id}")
def admin_update_course_pricing(
    course_id: int,
    data: CoursePricingUpdate,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Set live pricing (admin only). Takes effect for all new orders immediately."""
    course = db.query(Course).options(joinedload(Course.instructor)).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    pricing_type, amount, currency = pricing_service.resolve_amount(data.pricing_type, data.price, data.currency)
    previous = pricing_service.pricing_snapshot(course)
    course = pricing_service.apply_pricing(db, course, pricing_type, amount, currency, data.is_purchasable)
    log_audit_event(db, current_user.id, "update_course_pricing", "course", str(course.id),
                    previous_value=previous, new_value=pricing_service.pricing_snapshot(course), request=request)
    return pricing_service.serialize_course_pricing(course)


@router.get("/admin/requests")
def admin_list_price_requests(
    status: Optional[str] = Query("PENDING"),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    query = db.query(CoursePriceRequest).options(
        joinedload(CoursePriceRequest.course), joinedload(CoursePriceRequest.requester),
        joinedload(CoursePriceRequest.reviewer),
    )
    if status and status.upper() != "ALL":
        if status.upper() not in {s.value for s in PriceRequestStatus}:
            raise HTTPException(status_code=400, detail="Invalid status filter")
        query = query.filter(CoursePriceRequest.status == status.upper())
    rows = query.order_by(CoursePriceRequest.created_at.desc()).limit(200).all()
    return [pricing_service.serialize_price_request(r) for r in rows]


def _review(request_id: int, approve: bool, data: PriceRequestReview, request: Request,
            current_user: User, db: Session) -> dict:
    # Row lock (PostgreSQL) so two admins reviewing at once cannot both apply a decision.
    req = db.query(CoursePriceRequest).filter(CoursePriceRequest.id == request_id).with_for_update().first()
    if not req:
        raise HTTPException(status_code=404, detail="Price request not found")
    if req.status != PriceRequestStatus.PENDING.value:
        raise HTTPException(status_code=409, detail="This price request has already been reviewed")
    if not req.course:
        raise HTTPException(status_code=404, detail="Course no longer exists")
    previous = pricing_service.pricing_snapshot(req.course)
    req = pricing_service.review_price_request(db, req, current_user, approve, data.review_note)
    log_audit_event(db, current_user.id, "approve_price_request" if approve else "reject_price_request",
                    "course", str(req.course_id), previous_value=previous,
                    new_value=pricing_service.pricing_snapshot(req.course), request=request)
    return pricing_service.serialize_price_request(req)


@router.post("/admin/requests/{request_id}/approve")
def admin_approve_price_request(
    request_id: int,
    data: PriceRequestReview,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    return _review(request_id, True, data, request, current_user, db)


@router.post("/admin/requests/{request_id}/reject")
def admin_reject_price_request(
    request_id: int,
    data: PriceRequestReview,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    return _review(request_id, False, data, request, current_user, db)
