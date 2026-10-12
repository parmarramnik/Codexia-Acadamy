"""
Coding Service entrypoint.
Port: 8004
Owns: v3_coding, /coding, /git
"""
import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from routes import coding, v3_coding, git
from services import code_runner
from microservices.shared.factory import create_service_app

SERVICE_NAME = "Coding Service"
SERVICE_PORT = 8004

def _checks() -> dict:
    status = code_runner.health()
    # No provider is "degraded" (feature unavailable), not "unhealthy": the rest of the API still works.
    return {"code_execution": {**status, "status": "degraded" if status["status"] == "unavailable" else status["status"]}}

app = create_service_app(
    SERVICE_NAME,
    SERVICE_PORT,
    [
        (v3_coding.router, ""),
        (coding.router, "/coding"),
        (git.router, "/git"),
    ],
    extra_checks=_checks,
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=SERVICE_PORT)
