"""
Unit and integration tests for Git-for-Notes version control endpoints.
"""

import pytest
import json
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db
from main import app
from models.user import User
from models.content import Note
from models.git import GitBranch, GitCommit, GitTag, GitMergeHistory

# Setup static in-memory DB for tests
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    
    # Disable rate limiting for testing
    if hasattr(app, "state") and hasattr(app.state, "limiter"):
        app.state.limiter.enabled = False
        
    yield TestClient(app, raise_server_exceptions=True)
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def auth_headers(client):
    email = "git_tester_fixed@test.com"
    username = "git_tester_fixed"

    # Try signing up. If user already exists (duplicate), ignore it.
    client.post("/api/auth/signup", json={
        "email": email,
        "username": username,
        "full_name": "Git Tester",
        "password": "Password123!"
    })

    login_res = client.post("/api/auth/login", json={
        "email": email,
        "password": "Password123!"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_git_initialization_on_note_load(client, auth_headers):
    # 1. Create a note via API
    r = client.post("/api/notes", json={
        "title": "Git Basics",
        "content": "A note about git."
    }, headers=auth_headers)
    assert r.status_code == 200
    note_id = r.json()["id"]
    assert r.json()["current_branch_id"] is not None

    # 2. Get branches
    r = client.get(f"/api/git/branches?note_id={note_id}", headers=auth_headers)
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["name"] == "main"

    # 3. Get history (initial commit)
    r = client.get(f"/api/git/history?note_id={note_id}", headers=auth_headers)
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["message"] == "Initial commit"


def test_create_manual_commit(client, auth_headers):
    # Create note
    r = client.post("/api/notes", json={
        "title": "Normalization",
        "content": "First draft content."
    }, headers=auth_headers)
    note_id = r.json()["id"]

    # Modify working copy content
    r = client.put(f"/api/notes/{note_id}", json={
        "content": "First draft content. Modified with 1NF details."
    }, headers=auth_headers)

    # Commit manually
    r = client.post("/api/git/commit", json={
        "note_id": note_id,
        "message": "Added 1NF details",
        "is_checkpoint": True
    }, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["message"] == "Added 1NF details"
    assert r.json()["is_checkpoint"] is True

    # Get history - should have 2 commits now
    r = client.get(f"/api/git/history?note_id={note_id}", headers=auth_headers)
    assert len(r.json()) == 2
    assert r.json()[0]["message"] == "Added 1NF details"
    assert r.json()[1]["message"] == "Initial commit"


def test_checkout_warning_and_force(client, auth_headers):
    r = client.post("/api/notes", json={
        "title": "Branches Test",
        "content": "Base content."
    }, headers=auth_headers)
    note_id = r.json()["id"]

    # Create new branch
    r = client.post("/api/git/branch", json={
        "note_id": note_id,
        "name": "dev"
    }, headers=auth_headers)
    dev_branch_id = r.json()["id"]

    # Modify note working copy (creates unsaved changes)
    client.put(f"/api/notes/{note_id}", json={
        "content": "Unsaved modifications."
    }, headers=auth_headers)

    # Checkout branch without force - should warn
    r = client.post("/api/git/checkout", json={
        "note_id": note_id,
        "branch_id": dev_branch_id,
        "force": False
    }, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["unsaved_changes"] is True
    assert r.json()["success"] is False

    # Checkout branch with force - should succeed
    r = client.post("/api/git/checkout", json={
        "note_id": note_id,
        "branch_id": dev_branch_id,
        "force": True
    }, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["success"] is True
    assert r.json()["unsaved_changes"] is False


def test_fast_forward_merge(client, auth_headers):
    r = client.post("/api/notes", json={
        "title": "Merge Test",
        "content": "Base content."
    }, headers=auth_headers)
    note_id = r.json()["id"]

    # Save original main branch ID
    main_branch_id = r.json()["current_branch_id"]

    # Create feature branch
    r = client.post("/api/git/branch", json={
        "note_id": note_id,
        "name": "feature"
    }, headers=auth_headers)
    feat_branch_id = r.json()["id"]

    # Switch to feature branch
    client.post("/api/git/checkout", json={
        "note_id": note_id,
        "branch_id": feat_branch_id,
        "force": True
    }, headers=auth_headers)

    # Modify and commit on feature
    client.put(f"/api/notes/{note_id}", json={
        "content": "Base content. Feature added."
    }, headers=auth_headers)
    client.post("/api/git/commit", json={
        "note_id": note_id,
        "message": "Commit on feature"
    }, headers=auth_headers)

    # Merge feature into main (should be fast-forward)
    r = api_merge = client.post("/api/git/merge", json={
        "note_id": note_id,
        "source_branch_id": feat_branch_id,
        "target_branch_id": main_branch_id
    }, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "fast-forward"


def test_conflict_merge_and_resolution(client, auth_headers):
    r = client.post("/api/notes", json={
        "title": "Conflict Test",
        "content": "Line 1"
    }, headers=auth_headers)
    note_id = r.json()["id"]
    main_branch_id = r.json()["current_branch_id"]

    # Branch off 'dev'
    r = client.post("/api/git/branch", json={
        "note_id": note_id,
        "name": "dev"
    }, headers=auth_headers)
    dev_branch_id = r.json()["id"]

    # 1. Modify & Commit on main
    client.put(f"/api/notes/{note_id}", json={
        "content": "Line 1 modified on main"
    }, headers=auth_headers)
    client.post("/api/git/commit", json={
        "note_id": note_id,
        "message": "Main change"
    }, headers=auth_headers)

    # 2. Checkout dev, modify & commit on dev
    client.post("/api/git/checkout", json={
        "note_id": note_id,
        "branch_id": dev_branch_id,
        "force": True
    }, headers=auth_headers)

    client.put(f"/api/notes/{note_id}", json={
        "content": "Line 1 modified on dev"
    }, headers=auth_headers)
    client.post("/api/git/commit", json={
        "note_id": note_id,
        "message": "Dev change"
    }, headers=auth_headers)

    # 3. Merge dev into main - should trigger conflict
    r = client.post("/api/git/merge", json={
        "note_id": note_id,
        "source_branch_id": dev_branch_id,
        "target_branch_id": main_branch_id
    }, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "conflict"
    assert "conflict_content" in r.json()

    # 4. Resolve conflict with strategy 'keep_target'
    r = client.post("/api/git/merge", json={
        "note_id": note_id,
        "source_branch_id": dev_branch_id,
        "target_branch_id": main_branch_id,
        "resolve_strategy": "keep_target"
    }, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "success"


def test_cherry_pick(client, auth_headers):
    r = client.post("/api/notes", json={
        "title": "Cherry Test",
        "content": "Start content"
    }, headers=auth_headers)
    note_id = r.json()["id"]
    main_branch_id = r.json()["current_branch_id"]

    # Branch dev
    r = client.post("/api/git/branch", json={
        "note_id": note_id,
        "name": "dev"
    }, headers=auth_headers)
    dev_branch_id = r.json()["id"]

    # Switch to dev, modify & commit
    client.post("/api/git/checkout", json={
        "note_id": note_id,
        "branch_id": dev_branch_id,
        "force": True
    }, headers=auth_headers)
    
    client.put(f"/api/notes/{note_id}", json={
        "content": "Start content. Cherry changes."
    }, headers=auth_headers)
    r = client.post("/api/git/commit", json={
        "note_id": note_id,
        "message": "Dev commit to pick"
    }, headers=auth_headers)
    pick_commit_id = r.json()["id"]

    # Checkout main
    client.post("/api/git/checkout", json={
        "note_id": note_id,
        "branch_id": main_branch_id,
        "force": True
    }, headers=auth_headers)

    # Cherry pick commit onto main
    r = client.post("/api/git/cherry-pick", json={
        "note_id": note_id,
        "commit_id": pick_commit_id
    }, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "success"


def test_restore_commit(client, auth_headers):
    r = client.post("/api/notes", json={
        "title": "Restore Test",
        "content": "Version 1"
    }, headers=auth_headers)
    note_id = r.json()["id"]
    
    # Save V1 commit ID
    r_history = client.get(f"/api/git/history?note_id={note_id}", headers=auth_headers)
    v1_commit_id = r_history.json()[0]["id"]

    # Modify working copy to V2
    client.put(f"/api/notes/{note_id}", json={
        "content": "Version 2"
    }, headers=auth_headers)
    client.post("/api/git/commit", json={
        "note_id": note_id,
        "message": "Updated to V2"
    }, headers=auth_headers)

    # Revert/Restore V1
    r = client.post("/api/git/restore", json={
        "note_id": note_id,
        "commit_id": v1_commit_id
    }, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["content"] == "Version 1"


def test_export_endpoints(client, auth_headers):
    r = client.post("/api/notes", json={
        "title": "Export Test",
        "content": "Exportable text"
    }, headers=auth_headers)
    note_id = r.json()["id"]

    # JSON export
    r = client.get(f"/api/git/export?note_id={note_id}&format=json", headers=auth_headers)
    assert r.status_code == 200
    assert "application/json" in r.headers["content-type"]
    assert r.json()["note"]["title"] == "Export Test"

    # Markdown export
    r = client.get(f"/api/git/export?note_id={note_id}&format=markdown", headers=auth_headers)
    assert r.status_code == 200
    assert "text/markdown" in r.headers["content-type"]

    # PDF export
    r = client.get(f"/api/git/export?note_id={note_id}&format=pdf", headers=auth_headers)
    assert r.status_code == 200
    assert "application/pdf" in r.headers["content-type"]
