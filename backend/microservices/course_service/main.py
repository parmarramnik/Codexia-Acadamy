"""
Course Service entrypoint.
Port: 8002
Owns: /courses, /lectures, /course-builder, /notes, /flashcards, /study-planner
"""
import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from routes import courses, lectures, course_builder, notes, flashcards, study_planner
from microservices.shared.factory import create_service_app

SERVICE_NAME = "Course Service"
SERVICE_PORT = 8002

app = create_service_app(
    SERVICE_NAME,
    SERVICE_PORT,
    [
        (courses.router, "/courses"),
        (lectures.router, "/lectures"),
        (course_builder.router, "/course-builder"),
        (notes.router, "/notes"),
        (flashcards.router, "/flashcards"),
        (study_planner.router, "/study-planner"),
    ],
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=SERVICE_PORT)
