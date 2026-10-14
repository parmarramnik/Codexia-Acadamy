"""Test isolation: never read or write a developer's live Redis cache or payment records."""
import os

os.environ["REDIS_URL"] = "redis://127.0.0.1:1/0"  # unreachable -> in-memory cache fallback
# Tests that start the full app must not launch the background payment reconciler against the
# developer's configured database.
os.environ["PAYMENT_RECONCILE_INTERVAL_SECONDS"] = "0"
