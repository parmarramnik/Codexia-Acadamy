"""
Razorpay payment flow tests.

Only the outbound Razorpay HTTP calls are faked (a tiny in-memory gateway); every signature
is computed with real HMAC-SHA256 exactly as Razorpay does, so verification code runs for real.
"""

import hashlib
import hmac
import json
import itertools
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from config import settings
from database import Base, get_db
from main import app
from auth.jwt_handler import create_access_token
from middleware.rate_limiter import limiter
from models.user import User, UserRole
from models.course import Course, Enrollment, CourseCategory, Module, Lecture
from models.content import Video
from models.payment import Payment, PaymentEvent, PaymentIdempotencyKey, CoursePriceRequest
from services import payment_service, razorpay_client
from utils.cache import cache_invalidate_prefix

KEY_ID, KEY_SECRET, WEBHOOK_SECRET = "rzp_test_ABCDEF123456", "test_key_secret_value", "test_webhook_secret"

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# --------------------------------------------------------------------------- fake gateway

class FakeRazorpay:
    def __init__(self):
        self.orders, self.payments, self.refunds = {}, {}, {}
        self.seq = itertools.count(1)
        self.order_calls = 0
        self.capture_calls = 0
        self.fail_fetch = False
        self.fail_refund_response = False
        self.keys_revoked = False  # Razorpay answers 401, mapped by the client to a 503 RazorpayError

    def _id(self, prefix):
        return f"{prefix}_{next(self.seq):014d}"

    def _check_auth(self):
        if self.keys_revoked:
            raise razorpay_client.RazorpayError("Online payments are temporarily unavailable.", status_code=503)

    def create_order(self, amount, currency, receipt, notes=None):
        self._check_auth()
        self.order_calls += 1
        oid = self._id("order")
        self.orders[oid] = {"id": oid, "amount": amount, "currency": currency, "receipt": receipt, "status": "created"}
        return dict(self.orders[oid])

    def pay(self, order_id, status="captured", amount=None, method="upi", error=None):
        pid = self._id("pay")
        order = self.orders[order_id]
        self.payments[pid] = {"id": pid, "entity": "payment", "order_id": order_id, "status": status,
                              "amount": order["amount"] if amount is None else amount,
                              "currency": order["currency"], "method": method, "error_description": error}
        return pid

    def fetch_order(self, oid):
        self._check_auth()
        if oid not in self.orders:
            raise razorpay_client.RazorpayError(status_code=400, code="BAD_REQUEST_ERROR")
        statuses = [p["status"] for p in self.payments.values() if p["order_id"] == oid]
        status = "paid" if "captured" in statuses else "attempted" if statuses else "created"
        return {**self.orders[oid], "status": status}

    def fetch_payment(self, pid):
        if self.fail_fetch:
            raise razorpay_client.RazorpayError()
        return dict(self.payments[pid])

    def fetch_order_payments(self, oid):
        if self.fail_fetch:
            raise razorpay_client.RazorpayError()
        return [dict(p) for p in self.payments.values() if p["order_id"] == oid]

    def capture_payment(self, pid, amount, currency):
        self.capture_calls += 1
        self.payments[pid]["status"] = "captured"
        return dict(self.payments[pid])

    def create_refund(self, pid, amount, receipt, notes=None):
        if any(r["receipt"] == receipt for r in self.refunds.values()):
            raise razorpay_client.RazorpayError(status_code=400, code="BAD_REQUEST_ERROR")  # duplicate receipt
        rid = self._id("rfnd")
        self.refunds[rid] = {"id": rid, "entity": "refund", "payment_id": pid, "amount": amount,
                             "status": "pending", "receipt": receipt}
        if self.fail_refund_response:
            raise razorpay_client.RazorpayError()  # created at Razorpay, but the response was lost
        return dict(self.refunds[rid])

    def fetch_refund(self, rid):
        return dict(self.refunds[rid])

    def fetch_payment_refunds(self, pid):
        return [dict(r) for r in self.refunds.values() if r["payment_id"] == pid]


def checkout_signature(order_id, payment_id, secret=KEY_SECRET):
    return hmac.new(secret.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()


def webhook_body(event, payment=None, refund=None, order=None):
    payload = {}
    if payment:
        payload["payment"] = {"entity": payment}
    if refund:
        payload["refund"] = {"entity": refund}
    if order:
        payload["order"] = {"entity": order}
    return json.dumps({"entity": "event", "event": event, "payload": payload}, separators=(",", ":")).encode()


def webhook_headers(body, event_id, secret=WEBHOOK_SECRET):
    sig = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return {"X-Razorpay-Signature": sig, "x-razorpay-event-id": event_id, "Content-Type": "application/json"}


# --------------------------------------------------------------------------- fixtures

@pytest.fixture
def gateway(monkeypatch):
    fake = FakeRazorpay()
    for name in ("create_order", "fetch_order", "fetch_payment", "fetch_order_payments", "capture_payment",
                 "create_refund", "fetch_refund", "fetch_payment_refunds"):
        monkeypatch.setattr(razorpay_client, name, getattr(fake, name))
    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", KEY_ID)
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", KEY_SECRET)
    monkeypatch.setattr(settings, "RAZORPAY_WEBHOOK_SECRET", WEBHOOK_SECRET)
    return fake


@pytest.fixture
def db_session():
    import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    cache_invalidate_prefix("courses")
    from services import payment_service
    payment_service._last_reconcile.clear()  # ids restart at 1 in each fresh in-memory DB
    try:
        limiter.reset()
    except Exception:
        pass
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db_session):
    def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app, raise_server_exceptions=True)
    app.dependency_overrides.clear()


def _auth(user):
    return {"Authorization": f"Bearer {create_access_token({'sub': str(user.id)})}"}


@pytest.fixture
def world(db_session):
    instructor = User(email="i@x.io", username="instr", password_hash="x", full_name="Ins Tructor",
                      role=UserRole.INSTRUCTOR, is_verified=True)
    student = User(email="s@x.io", username="stud", password_hash="x", full_name="Stu Dent",
                   role=UserRole.STUDENT, is_verified=True)
    other = User(email="o@x.io", username="other", password_hash="x", full_name="Oth Er",
                 role=UserRole.STUDENT, is_verified=True)
    admin = User(email="a@x.io", username="admin", password_hash="x", full_name="Ad Min",
                 role=UserRole.ADMIN, is_verified=True)
    db_session.add_all([instructor, student, other, admin])
    db_session.flush()
    paid = Course(title="React Masterclass", slug="react-masterclass", description="desc long enough",
                  instructor_id=instructor.id, category=list(CourseCategory)[0], is_published=True,
                  is_approved=True, pricing_type="PAID", price_amount=99900, currency="INR", price=999.0)
    free = Course(title="Intro to Python", slug="intro-python", description="desc long enough",
                  instructor_id=instructor.id, category=list(CourseCategory)[0], is_published=True,
                  is_approved=True)
    db_session.add_all([paid, free])
    db_session.flush()
    module = Module(course_id=paid.id, title="M1", order_index=0)
    db_session.add(module)
    db_session.flush()
    lec_preview = Lecture(module_id=module.id, title="Preview", order_index=0, is_preview=True)
    lec_locked = Lecture(module_id=module.id, title="Locked", order_index=1, is_preview=False)
    db_session.add_all([lec_preview, lec_locked])
    db_session.flush()
    db_session.add_all([Video(lecture_id=lec_preview.id, file_url="https://v/preview.mp4", file_name="p"),
                        Video(lecture_id=lec_locked.id, file_url="https://v/locked.mp4", file_name="l")])
    db_session.commit()
    return {"instructor": instructor, "student": student, "other": other, "admin": admin,
            "paid": paid, "free": free}


def _enrollments(db, user, course):
    return db.query(Enrollment).filter(Enrollment.user_id == user.id, Enrollment.course_id == course.id).all()


def _buy(client, gateway, student, course):
    res = client.post("/api/payments/razorpay/order", json={"course_id": course.id}, headers=_auth(student))
    assert res.status_code == 200, res.text
    return res.json()


# --------------------------------------------------------------------------- order creation

def test_order_uses_database_price_and_exposes_only_public_key(client, gateway, world):
    order = _buy(client, gateway, world["student"], world["paid"])
    assert order["amount"] == 99900 and order["currency"] == "INR"
    assert order["key_id"] == KEY_ID
    assert KEY_SECRET not in json.dumps(order) and WEBHOOK_SECRET not in json.dumps(order)
    assert gateway.orders[order["order_id"]]["amount"] == 99900


def test_client_supplied_amount_is_ignored(client, gateway, world):
    res = client.post("/api/payments/razorpay/order",
                      json={"course_id": world["paid"].id, "amount": 100, "currency": "USD"},
                      headers=_auth(world["student"]))
    assert res.status_code == 200
    assert res.json()["amount"] == 99900 and res.json()["currency"] == "INR"


def test_double_click_reuses_the_same_order(client, gateway, world):
    a = _buy(client, gateway, world["student"], world["paid"])
    b = _buy(client, gateway, world["student"], world["paid"])
    assert a["order_id"] == b["order_id"] and gateway.order_calls == 1


def test_order_is_not_reused_after_the_api_key_changes(client, gateway, world, db_session, monkeypatch):
    # e.g. switching from test to live keys: Checkout rejects an order opened with the other key.
    old = _buy(client, gateway, world["student"], world["paid"])
    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", "rzp_live_NEWKEY1234567")
    new = _buy(client, gateway, world["student"], world["paid"])
    assert new["order_id"] != old["order_id"] and new["key_id"] == "rzp_live_NEWKEY1234567"
    assert gateway.order_calls == 2
    payment = db_session.query(Payment).filter(Payment.razorpay_order_id == new["order_id"]).one()
    assert payment.razorpay_key_id == "rzp_live_NEWKEY1234567"
    # Under the new key, the new order is reused as usual.
    assert _buy(client, gateway, world["student"], world["paid"])["order_id"] == new["order_id"]


def test_revoked_keys_fail_clearly_instead_of_reusing_an_order(client, gateway, world):
    # Without the gateway check, the stored order would be handed to Checkout, which then shows
    # Razorpay's "Something went wrong" page instead of a message from this app.
    _buy(client, gateway, world["student"], world["paid"])
    gateway.keys_revoked = True
    res = client.post("/api/payments/razorpay/order", json={"course_id": world["paid"].id},
                      headers=_auth(world["student"]))
    assert res.status_code == 503 and res.json()["detail"]["message"] == "Online payments are temporarily unavailable."
    assert gateway.order_calls == 1


def test_order_unknown_to_razorpay_is_replaced(client, gateway, world):
    old = _buy(client, gateway, world["student"], world["paid"])
    del gateway.orders[old["order_id"]]
    new = _buy(client, gateway, world["student"], world["paid"])
    assert new["order_id"] != old["order_id"] and gateway.order_calls == 2


def test_order_paid_at_razorpay_is_settled_not_resold(client, gateway, world, db_session):
    # Paid, but the verify call and webhook never reached the backend.
    old = _buy(client, gateway, world["student"], world["paid"])
    gateway.pay(old["order_id"])
    res = client.post("/api/payments/razorpay/order", json={"course_id": world["paid"].id},
                      headers=_auth(world["student"]))
    assert res.status_code == 409 and res.json()["detail"]["code"] == "ALREADY_ENROLLED"
    assert gateway.order_calls == 1
    assert len(_enrollments(db_session, world["student"], world["paid"])) == 1


@pytest.mark.parametrize("raw,clean", [
    ("  rzp_live_ABCDEF12345678  ", "rzp_live_ABCDEF12345678"),
    ('"rzp_live_ABCDEF12345678"', "rzp_live_ABCDEF12345678"),
    ("rzp_live_ABCDEF12345678\n", "rzp_live_ABCDEF12345678"),
    ("   ", None),
])
def test_razorpay_settings_are_cleaned(monkeypatch, raw, clean):
    from config import Settings
    monkeypatch.setenv("RAZORPAY_KEY_ID", raw)
    assert Settings().RAZORPAY_KEY_ID == clean


@pytest.mark.parametrize("key_id", ["rzp_test_ABCDEF12345678", "rzp_live_ABCDEF12345678"])
def test_wellformed_key_ids_count_as_configured(monkeypatch, key_id):
    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", key_id)
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", "secret")
    assert settings.payments_configured


@pytest.mark.parametrize("key_id", ["my-key", "rzp_prod_ABCDEF12345678", "rzp_live_", "rzp_live_ABC DEF12345678"])
def test_malformed_key_id_is_reported_as_unconfigured(client, gateway, world, monkeypatch, key_id):
    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", key_id)
    res = client.post("/api/payments/razorpay/order", json={"course_id": world["paid"].id},
                      headers=_auth(world["student"]))
    assert res.status_code == 503 and gateway.order_calls == 0


def test_orders_without_a_recorded_key_are_not_reused(client, gateway, world, db_session):
    old = _buy(client, gateway, world["student"], world["paid"])
    db_session.query(Payment).update({Payment.razorpay_key_id: None})  # rows from before the column existed
    db_session.commit()
    assert _buy(client, gateway, world["student"], world["paid"])["order_id"] != old["order_id"]


# --------------------------------------------------------------------------- idempotency keys

IDEM_KEY = "3f6c1d2e-8b4a-4c1e-9f0a-123456789abc"


def _order_with_key(client, student, course, key=IDEM_KEY):
    return client.post("/api/payments/razorpay/order", json={"course_id": course.id},
                       headers={**_auth(student), "Idempotency-Key": key})


def test_same_idempotency_key_replays_the_original_order(client, gateway, world, db_session):
    student, course = world["student"], world["paid"]
    first = _order_with_key(client, student, course)
    assert first.status_code == 200, first.text
    # Even after a price change (which would normally create a fresh order), a retry of the
    # same request gets back exactly what the first attempt created.
    course.price_amount = 149900
    db_session.commit()
    replay = _order_with_key(client, student, course)
    assert replay.status_code == 200
    assert replay.json()["order_id"] == first.json()["order_id"] and replay.json()["amount"] == 99900
    assert gateway.order_calls == 1
    # A new purchase attempt (new key) sees the new price.
    fresh = _order_with_key(client, student, course, key="a" * 32)
    assert fresh.json()["order_id"] != first.json()["order_id"] and fresh.json()["amount"] == 149900


def test_idempotency_replay_skips_an_order_from_another_api_key(client, gateway, world, monkeypatch):
    first = _order_with_key(client, world["student"], world["paid"]).json()
    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", "rzp_live_NEWKEY1234567")
    retry = _order_with_key(client, world["student"], world["paid"]).json()
    assert retry["order_id"] != first["order_id"] and retry["key_id"] == "rzp_live_NEWKEY1234567"


def test_idempotency_key_reused_for_a_different_course_is_rejected(client, gateway, world):
    assert _order_with_key(client, world["student"], world["paid"]).status_code == 200
    res = _order_with_key(client, world["student"], world["free"])
    assert res.status_code == 422 and res.json()["detail"]["code"] == "IDEMPOTENCY_KEY_REUSED"


def test_idempotency_keys_are_scoped_per_user(client, gateway, world):
    a = _order_with_key(client, world["student"], world["paid"]).json()
    b = _order_with_key(client, world["other"], world["paid"]).json()
    assert a["order_id"] != b["order_id"] and gateway.order_calls == 2


@pytest.mark.parametrize("key", ["short", "x" * 65, "has spaces in the key!!", "'; DROP TABLE payments;--"])
def test_malformed_idempotency_key_is_rejected(client, gateway, world, key):
    res = _order_with_key(client, world["student"], world["paid"], key=key)
    assert res.status_code == 400 and res.json()["detail"]["code"] == "INVALID_IDEMPOTENCY_KEY"
    assert gateway.order_calls == 0


def test_key_held_by_a_running_request_returns_409(client, gateway, world, db_session):
    student, course = world["student"], world["paid"]
    db_session.add(PaymentIdempotencyKey(user_id=student.id, key=IDEM_KEY,
                                         request_hash=payment_service.order_request_hash(course.id)))
    db_session.commit()
    res = _order_with_key(client, student, course)
    assert res.status_code == 409 and res.json()["detail"]["code"] == "REQUEST_IN_PROGRESS"
    assert gateway.order_calls == 0


def test_key_abandoned_mid_request_is_taken_over(client, gateway, world, db_session):
    student, course = world["student"], world["paid"]
    stale = datetime.now(timezone.utc) - payment_service.IDEMPOTENCY_IN_FLIGHT_TIMEOUT - timedelta(seconds=5)
    db_session.add(PaymentIdempotencyKey(user_id=student.id, key=IDEM_KEY, created_at=stale,
                                         request_hash=payment_service.order_request_hash(course.id)))
    db_session.commit()
    res = _order_with_key(client, student, course)
    assert res.status_code == 200 and gateway.order_calls == 1
    record = db_session.query(PaymentIdempotencyKey).filter_by(user_id=student.id, key=IDEM_KEY).one()
    assert record.payment_id == db_session.query(Payment).one().id


def test_failed_request_frees_its_key_for_a_retry(client, gateway, world, db_session, monkeypatch):
    calls = {"n": 0}

    def flaky_create_order(*args, **kwargs):
        calls["n"] += 1
        if calls["n"] == 1:
            raise razorpay_client.RazorpayError()
        return gateway.create_order(*args, **kwargs)

    monkeypatch.setattr(razorpay_client, "create_order", flaky_create_order)
    first = _order_with_key(client, world["student"], world["paid"])
    assert first.status_code == 502
    assert db_session.query(PaymentIdempotencyKey).count() == 0
    retry = _order_with_key(client, world["student"], world["paid"])
    assert retry.status_code == 200 and gateway.order_calls == 1


def test_replaying_a_key_after_payment_never_hands_out_the_order_again(client, gateway, world, db_session):
    student, course = world["student"], world["paid"]
    order = _order_with_key(client, student, course).json()
    pid = gateway.pay(order["order_id"])
    res = client.post("/api/payments/razorpay/verify", headers=_auth(student), json={
        "razorpay_order_id": order["order_id"], "razorpay_payment_id": pid,
        "razorpay_signature": checkout_signature(order["order_id"], pid)})
    assert res.json()["status"] == "SUCCESS"
    replay = _order_with_key(client, student, course)
    assert replay.status_code == 409 and replay.json()["detail"]["code"] == "ALREADY_ENROLLED"
    assert gateway.order_calls == 1 and len(_enrollments(db_session, student, course)) == 1


def test_expired_keys_are_pruned_and_can_be_reused(client, gateway, world, db_session):
    student = world["student"]
    old = datetime.now(timezone.utc) - payment_service.IDEMPOTENCY_KEY_TTL - timedelta(minutes=1)
    db_session.add_all([
        PaymentIdempotencyKey(user_id=student.id, key=IDEM_KEY, created_at=old,
                              request_hash=payment_service.order_request_hash(world["free"].id)),
        PaymentIdempotencyKey(user_id=student.id, key="b" * 32, created_at=old,
                              request_hash=payment_service.order_request_hash(world["paid"].id)),
    ])
    db_session.commit()
    # The expired key was for another course; after 24h it no longer binds the client.
    assert _order_with_key(client, student, world["paid"]).status_code == 200
    assert [r.key for r in db_session.query(PaymentIdempotencyKey).all()] == [IDEM_KEY]


@pytest.mark.parametrize("mutate,code", [
    (lambda c: setattr(c, "pricing_type", "FREE"), "COURSE_FREE"),
    (lambda c: setattr(c, "is_published", False), "COURSE_UNAVAILABLE"),
    (lambda c: setattr(c, "is_purchasable", False), "PURCHASE_DISABLED"),
    (lambda c: setattr(c, "price_amount", 50), "INVALID_PRICE"),
    (lambda c: setattr(c, "currency", "XYZ"), "INVALID_PRICE"),
])
def test_order_rejected_for_invalid_courses(client, gateway, world, db_session, mutate, code):
    mutate(world["paid"])
    db_session.commit()
    res = client.post("/api/payments/razorpay/order", json={"course_id": world["paid"].id},
                      headers=_auth(world["student"]))
    assert res.status_code == 400 and res.json()["detail"]["code"] == code
    assert gateway.order_calls == 0


def test_order_rejected_for_missing_course_and_unauthenticated(client, gateway, world):
    assert client.post("/api/payments/razorpay/order", json={"course_id": 9999},
                       headers=_auth(world["student"])).status_code == 404
    assert client.post("/api/payments/razorpay/order", json={"course_id": world["paid"].id}).status_code == 401
    assert client.post("/api/payments/razorpay/order", json={"course_id": "abc"},
                       headers=_auth(world["student"])).status_code == 422


def test_gateway_not_configured_returns_503(client, gateway, world, monkeypatch):
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", None)
    res = client.post("/api/payments/razorpay/order", json={"course_id": world["paid"].id},
                      headers=_auth(world["student"]))
    assert res.status_code == 503


# --------------------------------------------------------------------------- verification

def test_successful_checkout_creates_exactly_one_enrollment(client, gateway, world, db_session):
    student, course = world["student"], world["paid"]
    order = _buy(client, gateway, student, course)
    pid = gateway.pay(order["order_id"])
    body = {"razorpay_order_id": order["order_id"], "razorpay_payment_id": pid,
            "razorpay_signature": checkout_signature(order["order_id"], pid)}

    res = client.post("/api/payments/razorpay/verify", json=body, headers=_auth(student))
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "SUCCESS" and res.json()["enrolled"] is True

    # Duplicate callback (refresh / retry) is harmless
    again = client.post("/api/payments/razorpay/verify", json=body, headers=_auth(student))
    assert again.status_code == 200 and again.json()["status"] == "SUCCESS"

    assert len(_enrollments(db_session, student, course)) == 1
    payment = db_session.query(Payment).one()
    assert payment.status == "SUCCESS" and payment.razorpay_payment_id == pid
    assert payment.fulfilled_at is not None and payment.verified_via == "checkout"

    # Already enrolled -> cannot create another order
    res = client.post("/api/payments/razorpay/order", json={"course_id": course.id}, headers=_auth(student))
    assert res.status_code == 409 and res.json()["detail"]["code"] == "ALREADY_ENROLLED"


def test_invalid_signature_grants_nothing(client, gateway, world, db_session):
    student, course = world["student"], world["paid"]
    order = _buy(client, gateway, student, course)
    pid = gateway.pay(order["order_id"])
    for sig in (checkout_signature(order["order_id"], pid, secret="wrong"), "0" * 64):
        res = client.post("/api/payments/razorpay/verify", headers=_auth(student), json={
            "razorpay_order_id": order["order_id"], "razorpay_payment_id": pid, "razorpay_signature": sig})
        assert res.status_code == 400 and res.json()["detail"]["code"] == "SIGNATURE_INVALID"
    assert _enrollments(db_session, student, course) == []
    assert db_session.query(Payment).one().status == "CREATED"


def test_cannot_verify_someone_elses_order(client, gateway, world, db_session):
    order = _buy(client, gateway, world["student"], world["paid"])
    pid = gateway.pay(order["order_id"])
    res = client.post("/api/payments/razorpay/verify", headers=_auth(world["other"]), json={
        "razorpay_order_id": order["order_id"], "razorpay_payment_id": pid,
        "razorpay_signature": checkout_signature(order["order_id"], pid)})
    assert res.status_code == 404
    assert _enrollments(db_session, world["other"], world["paid"]) == []


def test_malformed_verify_payload_rejected(client, gateway, world):
    res = client.post("/api/payments/razorpay/verify", headers=_auth(world["student"]), json={
        "razorpay_order_id": "order_x'; DROP TABLE", "razorpay_payment_id": "pay_123456789",
        "razorpay_signature": "z" * 64})
    assert res.status_code == 400


def test_signature_valid_but_gateway_says_failed(client, gateway, world, db_session):
    student, course = world["student"], world["paid"]
    order = _buy(client, gateway, student, course)
    pid = gateway.pay(order["order_id"], status="failed", error="Card declined")
    res = client.post("/api/payments/razorpay/verify", headers=_auth(student), json={
        "razorpay_order_id": order["order_id"], "razorpay_payment_id": pid,
        "razorpay_signature": checkout_signature(order["order_id"], pid)})
    assert res.json()["status"] == "FAILED" and res.json()["failure_reason"] == "Card declined"
    assert _enrollments(db_session, student, course) == []

    # Retrying reuses the same order (Razorpay allows another attempt on it)
    retry = _buy(client, gateway, student, course)
    assert retry["order_id"] == order["order_id"]


def test_amount_mismatch_never_grants_access(client, gateway, world, db_session):
    student, course = world["student"], world["paid"]
    order = _buy(client, gateway, student, course)
    pid = gateway.pay(order["order_id"], amount=100)
    res = client.post("/api/payments/razorpay/verify", headers=_auth(student), json={
        "razorpay_order_id": order["order_id"], "razorpay_payment_id": pid,
        "razorpay_signature": checkout_signature(order["order_id"], pid)})
    assert res.json()["status"] == "PENDING"
    assert _enrollments(db_session, student, course) == []


def test_authorized_payment_is_captured_then_fulfilled(client, gateway, world, db_session):
    student, course = world["student"], world["paid"]
    order = _buy(client, gateway, student, course)
    pid = gateway.pay(order["order_id"], status="authorized")
    res = client.post("/api/payments/razorpay/verify", headers=_auth(student), json={
        "razorpay_order_id": order["order_id"], "razorpay_payment_id": pid,
        "razorpay_signature": checkout_signature(order["order_id"], pid)})
    assert res.json()["status"] == "SUCCESS"
    assert gateway.payments[pid]["status"] == "captured"
    assert len(_enrollments(db_session, student, course)) == 1


# --------------------------------------------------------------------------- network interruption / return flow

def test_gateway_outage_during_verify_then_status_poll_recovers(client, gateway, world, db_session):
    student, course = world["student"], world["paid"]
    order = _buy(client, gateway, student, course)
    pid = gateway.pay(order["order_id"])
    gateway.fail_fetch = True
    res = client.post("/api/payments/razorpay/verify", headers=_auth(student), json={
        "razorpay_order_id": order["order_id"], "razorpay_payment_id": pid,
        "razorpay_signature": checkout_signature(order["order_id"], pid)})
    assert res.json()["status"] == "PENDING"
    assert _enrollments(db_session, student, course) == []

    gateway.fail_fetch = False
    status = client.get(f"/api/payments/orders/{order['order_id']}/status", headers=_auth(student))
    assert status.status_code == 200
    assert status.json()["status"] == "SUCCESS" and status.json()["enrolled"] is True


def test_browser_closed_before_callback_course_page_reconciles(client, gateway, world, db_session):
    """Paid, closed the tab before the handler ran, webhook not delivered yet."""
    student, course = world["student"], world["paid"]
    order = _buy(client, gateway, student, course)
    gateway.pay(order["order_id"])
    state = client.get(f"/api/payments/courses/{course.id}/state", headers=_auth(student)).json()
    assert state["enrolled"] is True and state["latest_payment"]["status"] == "SUCCESS"
    assert db_session.query(Payment).one().verified_via == "reconcile"


def test_status_endpoint_is_owner_only(client, gateway, world):
    order = _buy(client, gateway, world["student"], world["paid"])
    assert client.get(f"/api/payments/orders/{order['order_id']}/status",
                      headers=_auth(world["other"])).status_code == 404
    assert client.get("/api/payments/orders/not-an-order/status",
                      headers=_auth(world["student"])).status_code == 400


# --------------------------------------------------------------------------- webhooks

def test_webhook_confirms_payment_and_is_idempotent(client, gateway, world, db_session):
    student, course = world["student"], world["paid"]
    order = _buy(client, gateway, student, course)
    pid = gateway.pay(order["order_id"])
    body = webhook_body("payment.captured", payment=gateway.payments[pid])
    headers = webhook_headers(body, "evt_001")

    first = client.post("/api/payments/razorpay/webhook", content=body, headers=headers)
    assert first.status_code == 200 and first.json()["status"] == "processed"
    for _ in range(2):
        dup = client.post("/api/payments/razorpay/webhook", content=body, headers=headers)
        assert dup.status_code == 200 and dup.json()["status"] == "duplicate"

    # A different event for the same payment (order.paid) is also harmless
    body2 = webhook_body("order.paid", payment=gateway.payments[pid], order=gateway.orders[order["order_id"]])
    assert client.post("/api/payments/razorpay/webhook", content=body2,
                       headers=webhook_headers(body2, "evt_002")).status_code == 200

    # And the frontend callback arriving late is harmless too
    client.post("/api/payments/razorpay/verify", headers=_auth(student), json={
        "razorpay_order_id": order["order_id"], "razorpay_payment_id": pid,
        "razorpay_signature": checkout_signature(order["order_id"], pid)})

    assert len(_enrollments(db_session, student, course)) == 1
    payments = db_session.query(Payment).all()
    assert len(payments) == 1 and payments[0].status == "SUCCESS" and payments[0].verified_via == "webhook"
    assert db_session.query(PaymentEvent).count() == 2


def test_webhook_rejects_bad_signature_and_tampered_body(client, gateway, world, db_session):
    order = _buy(client, gateway, world["student"], world["paid"])
    pid = gateway.pay(order["order_id"])
    body = webhook_body("payment.captured", payment=gateway.payments[pid])

    bad = client.post("/api/payments/razorpay/webhook", content=body,
                      headers=webhook_headers(body, "evt_x", secret="nope"))
    assert bad.status_code == 400
    headers = webhook_headers(body, "evt_y")
    tampered = body.replace(b'"captured"', b'"captured" ')
    assert client.post("/api/payments/razorpay/webhook", content=tampered, headers=headers).status_code == 400
    assert client.post("/api/payments/razorpay/webhook", content=body,
                       headers={"Content-Type": "application/json"}).status_code == 400

    assert _enrollments(db_session, world["student"], world["paid"]) == []
    assert db_session.query(PaymentEvent).count() == 0


def test_webhook_failure_event_then_success_on_retry(client, gateway, world, db_session):
    student, course = world["student"], world["paid"]
    order = _buy(client, gateway, student, course)
    failed_pid = gateway.pay(order["order_id"], status="failed", error="Bank declined")
    body = webhook_body("payment.failed", payment=gateway.payments[failed_pid])
    client.post("/api/payments/razorpay/webhook", content=body, headers=webhook_headers(body, "evt_f"))
    assert db_session.query(Payment).one().status == "FAILED"

    ok_pid = gateway.pay(order["order_id"])
    body = webhook_body("payment.captured", payment=gateway.payments[ok_pid])
    client.post("/api/payments/razorpay/webhook", content=body, headers=webhook_headers(body, "evt_s"))
    db_session.expire_all()
    p = db_session.query(Payment).one()
    assert p.status == "SUCCESS" and p.razorpay_payment_id == ok_pid
    assert len(_enrollments(db_session, student, course)) == 1

    # A late failure webhook for the old attempt must not downgrade SUCCESS
    body = webhook_body("payment.failed", payment=gateway.payments[failed_pid])
    client.post("/api/payments/razorpay/webhook", content=body, headers=webhook_headers(body, "evt_f2"))
    db_session.expire_all()
    assert db_session.query(Payment).one().status == "SUCCESS"


def test_webhook_for_unknown_order_is_ignored(client, gateway, world):
    body = webhook_body("payment.captured", payment={"id": "pay_00000000000099", "order_id": "order_unknown00001",
                                                     "status": "captured", "amount": 100, "currency": "INR"})
    res = client.post("/api/payments/razorpay/webhook", content=body, headers=webhook_headers(body, "evt_u"))
    assert res.status_code == 200 and res.json()["status"] == "ignored"


def test_webhook_without_secret_configured_is_refused(client, gateway, world, monkeypatch):
    monkeypatch.setattr(settings, "RAZORPAY_WEBHOOK_SECRET", None)
    body = webhook_body("payment.captured", payment={})
    assert client.post("/api/payments/razorpay/webhook", content=body,
                       headers=webhook_headers(body, "evt_n", secret="x")).status_code == 503


# --------------------------------------------------------------------------- enrollment protection

def test_free_enroll_endpoint_cannot_bypass_payment(client, gateway, world, db_session):
    res = client.post(f"/api/courses/{world['paid'].id}/enroll", headers=_auth(world["student"]))
    assert res.status_code == 402
    assert _enrollments(db_session, world["student"], world["paid"]) == []


def test_free_course_enrolls_directly_without_payment(client, gateway, world, db_session):
    res = client.post(f"/api/courses/{world['free'].id}/enroll", headers=_auth(world["student"]))
    assert res.status_code == 200
    assert db_session.query(Payment).count() == 0 and gateway.order_calls == 0


def test_paid_course_videos_locked_until_purchase(client, gateway, world, db_session):
    course, student = world["paid"], world["student"]

    def lectures(headers=None):
        mods = client.get(f"/api/courses/{course.id}/modules", headers=headers or {}).json()
        return {l["title"]: l for l in mods[0]["lectures"]}

    anon = lectures()
    assert anon["Preview"]["video_url"] and anon["Locked"]["video_url"] is None and anon["Locked"]["locked"]
    assert lectures(_auth(student))["Locked"]["video_url"] is None
    assert lectures(_auth(world["instructor"]))["Locked"]["video_url"]  # owner
    assert lectures(_auth(world["admin"]))["Locked"]["video_url"]       # admin

    order = _buy(client, gateway, student, course)
    pid = gateway.pay(order["order_id"])
    client.post("/api/payments/razorpay/verify", headers=_auth(student), json={
        "razorpay_order_id": order["order_id"], "razorpay_payment_id": pid,
        "razorpay_signature": checkout_signature(order["order_id"], pid)})
    unlocked = lectures(_auth(student))["Locked"]
    assert unlocked["video_url"] == "https://v/locked.mp4" and unlocked["locked"] is False

    expired = {"Authorization": "Bearer not-a-valid-token"}
    assert client.get(f"/api/courses/{course.id}/modules", headers=expired).status_code == 401


def test_enrollment_failure_keeps_payment_and_reconciles(client, gateway, world, db_session, monkeypatch):
    from services import payment_service
    student, course = world["student"], world["paid"]
    order = _buy(client, gateway, student, course)
    pid = gateway.pay(order["order_id"])
    original = payment_service._grant_enrollment

    def boom(*a, **k):
        raise RuntimeError("db hiccup")
    monkeypatch.setattr(payment_service, "_grant_enrollment", boom)
    res = client.post("/api/payments/razorpay/verify", headers=_auth(student), json={
        "razorpay_order_id": order["order_id"], "razorpay_payment_id": pid,
        "razorpay_signature": checkout_signature(order["order_id"], pid)})
    assert res.json()["status"] == "SUCCESS" and res.json()["access_pending"] is True
    p = db_session.query(Payment).one()
    assert p.status == "SUCCESS" and p.fulfilled_at is None

    monkeypatch.setattr(payment_service, "_grant_enrollment", original)
    out = client.post("/api/payments/admin/reconcile", headers=_auth(world["admin"])).json()
    assert out["updated"] == 1
    assert len(_enrollments(db_session, student, course)) == 1


# --------------------------------------------------------------------------- admin

def test_admin_endpoints_require_admin(client, gateway, world):
    for user in (world["student"], world["instructor"]):
        h = _auth(user)
        assert client.get("/api/payments/admin/list", headers=h).status_code == 403
        assert client.get("/api/payments/admin/summary", headers=h).status_code == 403
        assert client.post("/api/payments/admin/1/refund", json={}, headers=h).status_code == 403
        assert client.put(f"/api/pricing/admin/courses/{world['free'].id}",
                          json={"pricing_type": "PAID", "price": "1"}, headers=h).status_code == 403
        assert client.get("/api/pricing/admin/requests", headers=h).status_code == 403
    assert client.get("/api/payments/admin/list").status_code == 401


def test_admin_list_filters_and_never_leaks_secrets(client, gateway, world):
    order = _buy(client, gateway, world["student"], world["paid"])
    h = _auth(world["admin"])
    data = client.get("/api/payments/admin/list?status=CREATED", headers=h).json()
    assert data["total"] == 1 and data["items"][0]["razorpay_order_id"] == order["order_id"]
    assert data["items"][0]["student_email"] == "s@x.io"
    assert client.get("/api/payments/admin/list?status=SUCCESS", headers=h).json()["total"] == 0
    assert client.get("/api/payments/admin/list?status=BOGUS", headers=h).status_code == 400
    summary = client.get("/api/payments/admin/summary", headers=h).json()
    blob = json.dumps(summary) + json.dumps(data)
    assert KEY_SECRET not in blob and WEBHOOK_SECRET not in blob
    assert summary["mode"] == "test"


def test_refund_flow_revokes_access_only_when_razorpay_confirms(client, gateway, world, db_session):
    student, course, admin = world["student"], world["paid"], world["admin"]
    order = _buy(client, gateway, student, course)
    pid = gateway.pay(order["order_id"])
    client.post("/api/payments/razorpay/verify", headers=_auth(student), json={
        "razorpay_order_id": order["order_id"], "razorpay_payment_id": pid,
        "razorpay_signature": checkout_signature(order["order_id"], pid)})
    payment_id = db_session.query(Payment).one().id

    res = client.post(f"/api/payments/admin/{payment_id}/refund", json={"reason": "requested"}, headers=_auth(admin))
    assert res.status_code == 200 and res.json()["status"] == "SUCCESS" and res.json()["refund_status"] == "pending"
    assert client.post(f"/api/payments/admin/{payment_id}/refund", json={},
                       headers=_auth(admin)).status_code == 409  # no double refund
    assert len(gateway.refunds) == 1
    assert _enrollments(db_session, student, course)[0].is_active is True

    rid = res.json()["refund_id"]
    gateway.refunds[rid]["status"] = "processed"
    body = webhook_body("refund.processed", refund=gateway.refunds[rid])
    client.post("/api/payments/razorpay/webhook", content=body, headers=webhook_headers(body, "evt_r"))
    db_session.expire_all()
    p = db_session.query(Payment).one()
    assert p.status == "REFUNDED" and p.refunded_amount == 99900
    assert _enrollments(db_session, student, course)[0].is_active is False

    # A replayed capture webhook after refund must not re-grant access
    body = webhook_body("payment.captured", payment=gateway.payments[pid])
    client.post("/api/payments/razorpay/webhook", content=body, headers=webhook_headers(body, "evt_c"))
    db_session.expire_all()
    assert db_session.query(Payment).one().status == "REFUNDED"
    assert _enrollments(db_session, student, course)[0].is_active is False


def test_refund_rejected_for_unpaid_payment(client, gateway, world, db_session):
    _buy(client, gateway, world["student"], world["paid"])
    pid = db_session.query(Payment).one().id
    res = client.post(f"/api/payments/admin/{pid}/refund", json={}, headers=_auth(world["admin"]))
    assert res.status_code == 400 and gateway.refunds == {}


# --------------------------------------------------------------------------- pricing

def test_admin_sets_pricing_with_validation(client, gateway, world, db_session):
    h, cid = _auth(world["admin"]), world["free"].id
    url = f"/api/pricing/admin/courses/{cid}"
    ok = client.put(url, json={"pricing_type": "PAID", "price": "499", "currency": "INR"}, headers=h)
    assert ok.status_code == 200 and ok.json()["price_amount"] == 49900
    course = client.get(f"/api/courses/{cid}").json()
    assert course["pricing_type"] == "PAID" and course["price_amount"] == 49900 and course["price"] == 499.0

    assert client.put(url, json={"pricing_type": "PAID", "price": "499.99"}, headers=h).json()["price_amount"] == 49999
    for bad in ({"pricing_type": "PAID"}, {"pricing_type": "PAID", "price": "-5"},
                {"pricing_type": "PAID", "price": "0.5"}, {"pricing_type": "PAID", "price": "1.001"},
                {"pricing_type": "PAID", "price": "10", "currency": "USD"}, {"pricing_type": "MAYBE"},
                {"pricing_type": "PAID", "price": "9999999"}):
        assert client.put(url, json=bad, headers=h).status_code in (400, 422), bad

    free = client.put(url, json={"pricing_type": "FREE", "price": "123"}, headers=h).json()
    assert free["pricing_type"] == "FREE" and free["price_amount"] == 0


def test_instructor_cannot_change_live_price_directly(client, gateway, world, db_session):
    h, course = _auth(world["instructor"]), world["paid"]
    res = client.put(f"/api/courses/{course.id}", json={"price": 1.0, "title": "React Masterclass 2"}, headers=h)
    assert res.status_code == 200
    db_session.expire_all()
    c = db_session.query(Course).filter(Course.id == course.id).one()
    assert c.title == "React Masterclass 2" and c.price_amount == 99900 and c.price == 999.0

    created = client.post("/api/courses", headers=h, json={
        "title": "New Course", "description": "long enough description", "category": "programming",
        "price": 5000}).json()
    assert created["pricing_type"] == "FREE" and created["price_amount"] == 0 and created["price"] == 0


def test_instructor_price_request_approval_workflow(client, gateway, world, db_session):
    ih, ah, course = _auth(world["instructor"]), _auth(world["admin"]), world["free"]
    req = client.post("/api/pricing/requests", headers=ih, json={
        "course_id": course.id, "pricing_type": "PAID", "price": "299", "note": "Covers new labs"})
    assert req.status_code == 200 and req.json()["amount"] == 29900 and req.json()["status"] == "PENDING"
    # Not live yet
    assert client.get(f"/api/courses/{course.id}").json()["pricing_type"] == "FREE"
    # Only one pending request at a time
    assert client.post("/api/pricing/requests", headers=ih, json={
        "course_id": course.id, "pricing_type": "PAID", "price": "199"}).status_code == 400
    # Other instructors / students can't request on this course
    assert client.post("/api/pricing/requests", headers=_auth(world["student"]), json={
        "course_id": course.id, "pricing_type": "PAID", "price": "1"}).status_code == 403

    pending = client.get("/api/pricing/admin/requests", headers=ah).json()
    assert len(pending) == 1
    approved = client.post(f"/api/pricing/admin/requests/{pending[0]['id']}/approve", json={}, headers=ah)
    assert approved.status_code == 200 and approved.json()["status"] == "APPROVED"
    live = client.get(f"/api/courses/{course.id}").json()
    assert live["pricing_type"] == "PAID" and live["price_amount"] == 29900
    assert client.post(f"/api/pricing/admin/requests/{pending[0]['id']}/reject", json={},
                       headers=ah).status_code == 409

    mine = client.get("/api/pricing/requests/mine", headers=ih).json()
    assert mine[0]["status"] == "APPROVED"
    assert db_session.query(CoursePriceRequest).count() == 1


def test_instructor_cannot_request_for_others_course(client, gateway, world, db_session):
    other_instr = User(email="i2@x.io", username="instr2", password_hash="x", full_name="Other Instr",
                       role=UserRole.INSTRUCTOR, is_verified=True)
    db_session.add(other_instr)
    db_session.commit()
    res = client.post("/api/pricing/requests", headers=_auth(other_instr), json={
        "course_id": world["free"].id, "pricing_type": "PAID", "price": "10"})
    assert res.status_code == 403


# --------------------------------------------------------------------------- audit hardening

def _purchase(client, gateway, student, course):
    order = _buy(client, gateway, student, course)
    pid = gateway.pay(order["order_id"])
    res = client.post("/api/payments/razorpay/verify", headers=_auth(student), json={
        "razorpay_order_id": order["order_id"], "razorpay_payment_id": pid,
        "razorpay_signature": checkout_signature(order["order_id"], pid)})
    assert res.status_code == 200 and res.json()["status"] == "SUCCESS", res.text
    return order, pid


@pytest.fixture
def uploaded_video(world, db_session):
    """A real file under static/videos attached to a non-preview lecture of the paid course."""
    import os
    import uuid
    import main
    videos_dir = os.path.join(os.path.dirname(main.__file__), settings.UPLOAD_DIR, "videos")
    os.makedirs(videos_dir, exist_ok=True)
    name = f"test_{uuid.uuid4().hex}.mp4"
    path = os.path.join(videos_dir, name)
    with open(path, "wb") as f:
        f.write(b"0123456789" * 100)
    module = db_session.query(Module).filter(Module.course_id == world["paid"].id).one()
    lecture = Lecture(module_id=module.id, title="Uploaded", order_index=2, is_preview=False)
    db_session.add(lecture)
    db_session.flush()
    db_session.add(Video(lecture_id=lecture.id, file_url=f"/static/videos/{name}", file_name=name,
                         mime_type="video/mp4"))
    db_session.commit()
    yield {"lecture": lecture, "name": name}
    os.remove(path)


def _lecture(client, course, title, headers=None):
    mods = client.get(f"/api/courses/{course.id}/modules", headers=headers or {}).json()
    return {l["title"]: l for l in mods[0]["lectures"]}[title]


def test_uploaded_paid_video_only_streams_after_purchase(client, gateway, world, db_session, uploaded_video):
    from utils import media_access
    student, course, lecture = world["student"], world["paid"], uploaded_video["lecture"]
    name = uploaded_video["name"]

    # The raw file is never publicly served, however the path is spelled.
    for path in (f"/static/videos/{name}", f"/static/Videos/{name}", f"/static/./videos/{name}"):
        assert client.get(path).status_code == 404, path

    # Not purchased: no URL handed out, and even a correctly signed link for this learner is refused.
    assert _lecture(client, course, "Uploaded", _auth(student))["video_url"] is None
    assert client.get(media_access.signed_stream_path(lecture.id, student.id)).status_code == 403
    assert client.get(media_access.signed_stream_path(lecture.id, None)).status_code == 403  # anonymous

    _purchase(client, gateway, student, course)
    url = _lecture(client, course, "Uploaded", _auth(student))["video_url"]
    assert url.startswith(f"/api/lectures/{lecture.id}/stream?") and "/static/" not in url
    full = client.get(url)
    assert full.status_code == 200 and full.content == b"0123456789" * 100
    part = client.get(url, headers={"Range": "bytes=10-19"})
    assert part.status_code == 206 and part.content == b"0123456789"
    assert part.headers["content-range"] == "bytes 10-19/1000"
    assert client.get(url, headers={"Range": "bytes=-5"}).content == b"56789"
    assert client.get(url, headers={"Range": "bytes=5000-"}).status_code == 416

    # Tampered, re-targeted or expired links are rejected.
    tampered = url[:-1] + ("0" if url[-1] != "0" else "1")
    assert client.get(tampered).status_code == 403
    assert client.get(url.replace(f"uid={student.id}", f"uid={world['other'].id}")).status_code == 403
    assert client.get(f"/api/lectures/{lecture.id}/stream?uid={student.id}&exp=1&sig={'a' * 64}").status_code == 403

    # After a confirmed refund, the previously issued link stops working.
    payment_id = db_session.query(Payment).one().id
    rid = client.post(f"/api/payments/admin/{payment_id}/refund", json={},
                      headers=_auth(world["admin"])).json()["refund_id"]
    gateway.refunds[rid]["status"] = "processed"
    body = webhook_body("refund.processed", refund=gateway.refunds[rid])
    client.post("/api/payments/razorpay/webhook", content=body, headers=webhook_headers(body, "evt_rv"))
    assert client.get(url).status_code == 403


def test_free_course_uploaded_video_still_plays_for_everyone(client, gateway, world, db_session, uploaded_video):
    world["paid"].pricing_type, world["paid"].price_amount = "FREE", 0
    db_session.commit()
    url = _lecture(client, world["paid"], "Uploaded")["video_url"]  # anonymous viewer
    assert url and client.get(url).status_code == 200


def test_signed_stream_url_is_never_saved_as_the_video_source(client, gateway, world, db_session, uploaded_video):
    lecture, h = uploaded_video["lecture"], _auth(world["instructor"])
    info = _lecture(client, world["paid"], "Uploaded", h)
    assert info["source_url"] == f"/static/videos/{uploaded_video['name']}"
    assert _lecture(client, world["paid"], "Uploaded", _auth(world["student"]))["source_url"] is None

    client.put(f"/api/lectures/{lecture.id}", json={"video_url": info["video_url"]}, headers=h)
    client.post(f"/api/lectures/{lecture.id}/video-url",
                json={"video_url": "https://api.example.com" + info["video_url"]}, headers=h)
    db_session.expire_all()
    assert db_session.query(Video).filter(Video.lecture_id == lecture.id).one().file_url == info["source_url"]


def test_refund_retry_after_lost_response_never_refunds_twice(client, gateway, world, db_session):
    _purchase(client, gateway, world["student"], world["paid"])
    payment_id, h = db_session.query(Payment).one().id, _auth(world["admin"])
    gateway.fail_refund_response = True  # Razorpay created the refund but our request timed out
    res = client.post(f"/api/payments/admin/{payment_id}/refund", json={}, headers=h)
    assert res.status_code == 200 and res.json()["refund_status"] == "pending"
    gateway.fail_refund_response = False
    assert client.post(f"/api/payments/admin/{payment_id}/refund", json={}, headers=h).status_code == 409
    assert len(gateway.refunds) == 1
    assert list(gateway.refunds.values())[0]["receipt"] == f"rfnd_p{payment_id}_0"


def test_failed_refund_can_be_retried_with_a_new_receipt(client, gateway, world, db_session):
    _purchase(client, gateway, world["student"], world["paid"])
    payment_id, h = db_session.query(Payment).one().id, _auth(world["admin"])
    first = client.post(f"/api/payments/admin/{payment_id}/refund", json={}, headers=h).json()
    gateway.refunds[first["refund_id"]]["status"] = "failed"
    body = webhook_body("refund.failed", refund=gateway.refunds[first["refund_id"]])
    client.post("/api/payments/razorpay/webhook", content=body, headers=webhook_headers(body, "evt_rf"))
    second = client.post(f"/api/payments/admin/{payment_id}/refund", json={}, headers=h)
    assert second.status_code == 200 and second.json()["refund_id"] != first["refund_id"]
    assert sorted(r["receipt"] for r in gateway.refunds.values()) == [
        f"rfnd_p{payment_id}_0", f"rfnd_p{payment_id}_1"]
    # A late event for the superseded attempt must not clobber the new refund's state.
    client.post("/api/payments/razorpay/webhook", content=body, headers=webhook_headers(body, "evt_rf_late"))
    db_session.expire_all()
    assert db_session.query(Payment).one().refund_status == "pending"


def test_payment_refunded_before_confirmation_never_grants_access(client, gateway, world, db_session):
    student, course = world["student"], world["paid"]
    order = _buy(client, gateway, student, course)
    gateway.pay(order["order_id"], status="refunded")  # e.g. refunded from the Razorpay dashboard
    data = client.get(f"/api/payments/orders/{order['order_id']}/status", headers=_auth(student)).json()
    assert data["status"] == "REFUNDED" and data["enrolled"] is False
    assert _enrollments(db_session, student, course) == []


def test_late_authorized_webhook_after_success_is_a_noop(client, gateway, world, db_session):
    _, pid = _purchase(client, gateway, world["student"], world["paid"])
    stale = dict(gateway.payments[pid], status="authorized")
    body = webhook_body("payment.authorized", payment=stale)
    res = client.post("/api/payments/razorpay/webhook", content=body, headers=webhook_headers(body, "evt_late"))
    assert res.status_code == 200 and gateway.capture_calls == 0
    db_session.expire_all()
    assert db_session.query(Payment).one().status == "SUCCESS"


def test_second_paid_order_for_same_course_is_flagged_for_refund(client, gateway, world, db_session):
    student, course = world["student"], world["paid"]
    first = _buy(client, gateway, student, course)
    course.price_amount = 89900  # price changed -> the open order can't be reused, a second one is created
    db_session.commit()
    second = _buy(client, gateway, student, course)
    assert first["order_id"] != second["order_id"]
    for order in (first, second):  # learner paid in two tabs
        pid = gateway.pay(order["order_id"])
        client.post("/api/payments/razorpay/verify", headers=_auth(student), json={
            "razorpay_order_id": order["order_id"], "razorpay_payment_id": pid,
            "razorpay_signature": checkout_signature(order["order_id"], pid)})
    assert len(_enrollments(db_session, student, course)) == 1
    rows = client.get("/api/payments/admin/list?status=SUCCESS", headers=_auth(world["admin"])).json()["items"]
    flagged = [r for r in rows if r["admin_note"]]
    assert len(rows) == 2 and len(flagged) == 1 and flagged[0]["razorpay_order_id"] == second["order_id"]


def test_paid_learner_without_access_is_repaired_not_recharged(client, gateway, world, db_session):
    student, course = world["student"], world["paid"]
    _purchase(client, gateway, student, course)
    _enrollments(db_session, student, course)[0].is_active = False
    db_session.commit()
    res = client.post("/api/payments/razorpay/order", json={"course_id": course.id}, headers=_auth(student))
    assert res.status_code == 409 and res.json()["detail"]["code"] == "ALREADY_ENROLLED"
    assert gateway.order_calls == 1
    db_session.expire_all()
    assert _enrollments(db_session, student, course)[0].is_active is True


def test_payment_for_one_course_cannot_unlock_another(client, gateway, world, db_session):
    student = world["student"]
    cheap = Course(title="Cheap", slug="cheap", description="desc long enough", instructor_id=world["instructor"].id,
                   category=list(CourseCategory)[0], is_published=True, is_approved=True,
                   pricing_type="PAID", price_amount=100, currency="INR")
    db_session.add(cheap)
    db_session.commit()
    expensive_order = _buy(client, gateway, student, world["paid"])
    cheap_order = _buy(client, gateway, student, cheap)
    cheap_pid = gateway.pay(cheap_order["order_id"])

    # Real signature for the cheap order replayed against the expensive order: rejected.
    res = client.post("/api/payments/razorpay/verify", headers=_auth(student), json={
        "razorpay_order_id": expensive_order["order_id"], "razorpay_payment_id": cheap_pid,
        "razorpay_signature": checkout_signature(cheap_order["order_id"], cheap_pid)})
    assert res.status_code == 400
    # Even a (hypothetically) valid signature can't move a payment between orders: the gateway record decides.
    client.post("/api/payments/razorpay/verify", headers=_auth(student), json={
        "razorpay_order_id": expensive_order["order_id"], "razorpay_payment_id": cheap_pid,
        "razorpay_signature": checkout_signature(expensive_order["order_id"], cheap_pid)})
    assert _enrollments(db_session, student, world["paid"]) == []
