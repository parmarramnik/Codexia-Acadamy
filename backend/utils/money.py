"""
Money helpers. All amounts are integers in the currency's smallest unit (paise for INR);
Decimal is used only to parse human-entered prices. Never use float for money.
"""

from decimal import Decimal, InvalidOperation, ROUND_DOWN
from typing import Union

SUPPORTED_CURRENCIES = {"INR"}
DEFAULT_CURRENCY = "INR"

# Smallest-unit multiplier per currency.
_MINOR_UNITS = {"INR": 100}

# Razorpay's minimum order is ₹1.00. The upper bound is a sanity cap against typos.
MIN_PAID_AMOUNT = {"INR": 100}             # ₹1
MAX_PAID_AMOUNT = {"INR": 50_000_000}      # ₹5,00,000


class MoneyError(ValueError):
    """Raised for invalid prices or currencies. Messages are safe to show to users."""


def normalize_currency(currency: str) -> str:
    code = (currency or "").strip().upper()
    if code not in SUPPORTED_CURRENCIES:
        raise MoneyError(f"Unsupported currency. Supported: {', '.join(sorted(SUPPORTED_CURRENCIES))}")
    return code


def to_minor_units(price: Union[Decimal, int, str], currency: str = DEFAULT_CURRENCY) -> int:
    """Convert a major-unit price (e.g. Decimal('499.00') rupees) to minor units (49900 paise)."""
    currency = normalize_currency(currency)
    try:
        value = price if isinstance(price, Decimal) else Decimal(str(price).strip())
    except (InvalidOperation, ValueError):
        raise MoneyError("Price must be a valid number")
    if not value.is_finite():
        raise MoneyError("Price must be a valid number")
    if value < 0:
        raise MoneyError("Price cannot be negative")
    if value != value.quantize(Decimal("0.01"), rounding=ROUND_DOWN):
        raise MoneyError("Price can have at most 2 decimal places")
    return int(value * _MINOR_UNITS[currency])


def validate_paid_amount(amount: int, currency: str = DEFAULT_CURRENCY) -> int:
    """Ensure a paid amount (minor units) is within the allowed range."""
    currency = normalize_currency(currency)
    if not isinstance(amount, int) or isinstance(amount, bool):
        raise MoneyError("Invalid amount")
    if amount < MIN_PAID_AMOUNT[currency]:
        raise MoneyError("A paid course must cost at least ₹1.00")
    if amount > MAX_PAID_AMOUNT[currency]:
        raise MoneyError("Price exceeds the maximum allowed (₹5,00,000)")
    return amount


def to_major_display(amount: int, currency: str = DEFAULT_CURRENCY) -> float:
    """Major-unit value for display-only fields (e.g. the legacy Course.price column)."""
    divisor = _MINOR_UNITS.get((currency or DEFAULT_CURRENCY).upper(), 100)
    return float(Decimal(int(amount or 0)) / Decimal(divisor))
