"""
Extra payment-security cases (complements test_payments.py, whose fixtures and fake gateway it reuses).
Only Razorpay's HTTP API is faked; signatures are real HMAC-SHA256. These are mock-gateway tests,
not genuine Razorpay Test Mode transactions.
"""
from datetime import timedelta

import pytest
from sqlalchemy.exc import IntegrityError

from auth.jwt_handler import create_access_token
from models.course import Course, CourseCategory, Enrollment
from models.payment import Payment
from services import payment_service

# Fixtures and helpers shared with the main payment suite.
from test_payments import (  # noqa: F401
    checkout_signature, client, db_session, gateway, world, _auth, _buy, _enrollments,
)


def _second_paid_course(db, instructor):
    course = Course(title="Vue Masterclass", slug="vue-masterclass", description="desc long enough",
                    instructor_id=instructor.id, category=list(CourseCategory)[0], is_published=True,
                    is_approved=True, pricing_type="PAID", price_amount=99900, currency="INR", price=999.0)
    db.add(course)
    db.commit()
    return course


def test_payment_id_from_another_order_cannot_unlock_a_different_course(client, gateway, world, db_session):
    student = world["student"]
    other_course = _second_paid_course(db_session, world["instructor"])
    order_a = _buy(client, gateway, student, world["paid"])
    order_b = _buy(client, gateway, student, other_course)
    pay_a = gateway.pay(order_a["order_id"])  # captured, but it belongs to order A

    # Even with a signature that is valid for the (order B, payment A) pair, the gateway says payment A
    # belongs to order A, so nothing may be granted for course B.
    body = {"razorpay_order_id": order_b["order_id"], "razorpay_payment_id": pay_a,
            "razorpay_signature": checkout_signature(order_b["order_id"], pay_a)}
    client.post("/api/payments/razorpay/verify", json=body, headers=_auth(student))
    assert _enrollments(db_session, student, other_course) == []
    payment_b = db_session.query(Payment).filter(Payment.razorpay_order_id == order_b["order_id"]).one()
    assert payment_b.status != "SUCCESS" and payment_b.fulfilled_at is None


def test_expired_or_missing_authentication_is_rejected_on_payment_endpoints(client, gateway, world, db_session):
    student, course = world["student"], world["paid"]
    expired = {"Authorization": "Bearer " + create_access_token({"sub": str(student.id)}, expires_delta=timedelta(minutes=-5))}
    body = {"razorpay_order_id": "order_ABCDEF123456", "razorpay_payment_id": "pay_ABCDEF123456",
            "razorpay_signature": "a" * 64}
    for headers in (expired, {}):
        assert client.post("/api/payments/razorpay/order", json={"course_id": course.id}, headers=headers).status_code in (401, 403)
        assert client.post("/api/payments/razorpay/verify", json=body, headers=headers).status_code in (401, 403)
        assert client.get("/api/payments/me", headers=headers).status_code in (401, 403)
    assert gateway.order_calls == 0 and db_session.query(Payment).count() == 0


def test_database_enforces_one_enrollment_per_user_and_course(db_session, world):
    student, course = world["student"], world["paid"]
    payment_service._grant_enrollment(db_session, student.id, course.id)
    payment_service._grant_enrollment(db_session, student.id, course.id)  # repeated grant is idempotent
    db_session.commit()
    assert len(_enrollments(db_session, student, course)) == 1

    db_session.add(Enrollment(user_id=student.id, course_id=course.id, is_active=True))
    with pytest.raises(IntegrityError):  # the unique constraint is the last line of defence
        db_session.commit()
    db_session.rollback()
