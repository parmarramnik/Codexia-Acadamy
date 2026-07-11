"""
Middleware package.
"""

from middleware.cors import setup_cors
from middleware.rate_limiter import setup_rate_limiter
from middleware.error_handler import setup_error_handlers

__all__ = ["setup_cors", "setup_rate_limiter", "setup_error_handlers"]
