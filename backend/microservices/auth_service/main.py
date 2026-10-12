"""
Auth Service entrypoint.
Port: 8001
Owns: /auth, /users
"""
import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from routes import auth, users
from microservices.shared.factory import create_service_app

SERVICE_NAME = "Auth Service"
SERVICE_PORT = 8001

app = create_service_app(
    SERVICE_NAME,
    SERVICE_PORT,
    [
        (auth.router, "/auth"),
        (users.router, "/users"),
    ],
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=SERVICE_PORT)
