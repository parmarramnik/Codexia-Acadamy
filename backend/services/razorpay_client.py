"""
Thin Razorpay REST client + signature verification.

Uses the official REST API (https://razorpay.com/docs/api/) over httpx with HTTP Basic auth
(key_id:key_secret). Secrets never leave this module: they are not logged, not included in
exception messages, and not returned to callers.
"""

import hashlib
import hmac
import logging
from typing import Any, Optional

import httpx

from config import settings

logger = logging.getLogger("codexia.payments.razorpay")


class RazorpayError(Exception):
    """Gateway failure. `message` is safe to show users; details go to server logs only."""

    def __init__(self, message: str = "Payment gateway error. Please try again.", *, status_code: int = 502,
                 code: Optional[str] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code


class RazorpayNotConfigured(RazorpayError):
    def __init__(self):
        super().__init__("Online payments are temporarily unavailable.", status_code=503, code="NOT_CONFIGURED")


def _request(method: str, path: str, json: Optional[dict] = None) -> Any:
    if not settings.payments_configured:
        raise RazorpayNotConfigured()
    url = f"{settings.RAZORPAY_API_BASE.rstrip('/')}/{path.lstrip('/')}"
    try:
        with httpx.Client(timeout=settings.RAZORPAY_TIMEOUT_SECONDS) as client:
            resp = client.request(
                method, url, json=json,
                auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET),
            )
    except httpx.HTTPError as exc:
        # Exception type only — the request object would carry the auth header.
        logger.error("Razorpay %s %s network error: %s", method, path, type(exc).__name__)
        raise RazorpayError("Could not reach the payment gateway. Please try again.", status_code=502)

    if resp.status_code >= 400:
        code = description = None
        try:
            err = resp.json().get("error", {}) or {}
            code, description = err.get("code"), err.get("description")
        except Exception:
            pass
        logger.error("Razorpay %s %s failed: http=%s code=%s description=%s",
                     method, path, resp.status_code, code, description)
        if resp.status_code == 401:
            raise RazorpayError("Online payments are temporarily unavailable.", status_code=503, code=code)
        raise RazorpayError(status_code=502 if resp.status_code >= 500 else 400, code=code)
    try:
        return resp.json()
    except ValueError:
        logger.error("Razorpay %s %s returned a non-JSON body", method, path)
        raise RazorpayError()


# ---------------------------------------------------------------- API calls

def create_order(amount: int, currency: str, receipt: str, notes: Optional[dict] = None) -> dict:
    return _request("POST", "/orders", json={
        "amount": int(amount),
        "currency": currency,
        "receipt": receipt[:40],
        "notes": notes or {},
    })


def fetch_order(order_id: str) -> dict:
    return _request("GET", f"/orders/{order_id}")


def fetch_payment(payment_id: str) -> dict:
    return _request("GET", f"/payments/{payment_id}")


def fetch_order_payments(order_id: str) -> list[dict]:
    data = _request("GET", f"/orders/{order_id}/payments")
    return data.get("items", []) if isinstance(data, dict) else []


def capture_payment(payment_id: str, amount: int, currency: str) -> dict:
    return _request("POST", f"/payments/{payment_id}/capture", json={"amount": int(amount), "currency": currency})


def create_refund(payment_id: str, amount: int, receipt: str, notes: Optional[dict] = None) -> dict:
    """`receipt` is Razorpay's refund idempotency key: a repeated receipt is rejected, never refunded twice."""
    return _request("POST", f"/payments/{payment_id}/refund",
                    json={"amount": int(amount), "receipt": receipt[:40], "notes": notes or {}})


def fetch_payment_refunds(payment_id: str) -> list[dict]:
    data = _request("GET", f"/payments/{payment_id}/refunds")
    return data.get("items", []) if isinstance(data, dict) else []


def fetch_refund(refund_id: str) -> dict:
    return _request("GET", f"/refunds/{refund_id}")


# ---------------------------------------------------------------- Signatures

def _hmac_hex(secret: str, message: bytes) -> str:
    return hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()


def verify_payment_signature(order_id: str, payment_id: str, signature: str) -> bool:
    """Checkout signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret)."""
    if not settings.RAZORPAY_KEY_SECRET or not signature:
        return False
    expected = _hmac_hex(settings.RAZORPAY_KEY_SECRET, f"{order_id}|{payment_id}".encode("utf-8"))
    return hmac.compare_digest(expected, signature)


def verify_webhook_signature(raw_body: bytes, signature: str) -> bool:
    """Webhook signature: HMAC_SHA256(raw request body, webhook_secret)."""
    if not settings.RAZORPAY_WEBHOOK_SECRET or not signature:
        return False
    expected = _hmac_hex(settings.RAZORPAY_WEBHOOK_SECRET, raw_body)
    return hmac.compare_digest(expected, signature)
