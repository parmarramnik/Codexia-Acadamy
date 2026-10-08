"""
Payment & pricing request schemas. Clients never send amounts for purchases — only IDs.
"""

from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field


class CreateOrderRequest(BaseModel):
    course_id: int = Field(..., gt=0)


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str = Field(..., min_length=10, max_length=64)
    razorpay_payment_id: str = Field(..., min_length=8, max_length=64)
    razorpay_signature: str = Field(..., min_length=64, max_length=64)


class RefundRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=200)


class CoursePricingUpdate(BaseModel):
    """Admin-only live pricing. `price` is in major units (rupees) with at most 2 decimals."""
    pricing_type: Literal["FREE", "PAID"]
    price: Optional[Decimal] = Field(None, ge=0, max_digits=12, decimal_places=2)
    currency: str = Field("INR", min_length=3, max_length=3)
    is_purchasable: bool = True


class PriceRequestCreate(BaseModel):
    course_id: int = Field(..., gt=0)
    pricing_type: Literal["FREE", "PAID"]
    price: Optional[Decimal] = Field(None, ge=0, max_digits=12, decimal_places=2)
    currency: str = Field("INR", min_length=3, max_length=3)
    note: Optional[str] = Field(None, max_length=1000)


class PriceRequestReview(BaseModel):
    review_note: Optional[str] = Field(None, max_length=1000)
