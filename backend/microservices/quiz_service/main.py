"""
Quiz Service entrypoint.
Port: 8003
Owns: /quizzes, /certificates, v3_certificates
"""
import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from routes import quizzes, certificates, v3_certificates
from microservices.shared.factory import create_service_app

SERVICE_NAME = "Quiz Service"
SERVICE_PORT = 8003

app = create_service_app(
    SERVICE_NAME,
    SERVICE_PORT,
    [
        (quizzes.router, "/quizzes"),
        (certificates.router, "/certificates"),
        (v3_certificates.router, ""),
    ],
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=SERVICE_PORT)
