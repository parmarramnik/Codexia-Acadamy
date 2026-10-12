"""
Analytics Service entrypoint.
Port: 8006
Owns: /analytics, v3_analytics, /admin, v4_admin, /logs, v3_search, v3_comms
"""
import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from routes import analytics, v3_analytics, admin, v4_admin, logs, v3_search, v3_comms
from microservices.shared.factory import create_service_app

SERVICE_NAME = "Analytics Service"
SERVICE_PORT = 8006

def _start_search_sync() -> None:
    """Optional Elasticsearch: initialise + sync in the background so startup never blocks on it."""
    import threading

    def run():
        import time
        from database import SessionLocal
        from utils.elasticsearch_client import init_indices, is_es_available
        from services.search_service import sync_all_to_elasticsearch
        for _ in range(15):
            if is_es_available():
                init_indices()
                db = SessionLocal()
                try:
                    sync_all_to_elasticsearch(db)
                finally:
                    db.close()
                return
            time.sleep(2)

    threading.Thread(target=run, daemon=True).start()

app = create_service_app(
    SERVICE_NAME,
    SERVICE_PORT,
    [
        (analytics.router, "/analytics"),
        (v3_analytics.router, ""),
        (admin.router, "/admin"),
        (v4_admin.router, ""),
        (logs.router, "/logs"),
        (v3_search.router, ""),
        (v3_comms.router, ""),
    ],
    on_startup=_start_search_sync,
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=SERVICE_PORT)
