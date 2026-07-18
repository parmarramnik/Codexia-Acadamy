"""Quick smoke test for the backend API."""
import httpx
import json
import uuid

BASE = "http://localhost:8000"
client = httpx.Client(base_url=BASE, timeout=10)

def test():
    uid = uuid.uuid4().hex[:6]
    email = f"smoke{uid}@test.com"
    username = f"smoke{uid}"

    # 1. Health check
    r = client.get("/api/health")
    print(f"[1] Health: {r.status_code} -> {r.json()}")
    assert r.status_code == 200

    # 2. Signup
    r = client.post("/api/auth/signup", json={
        "email": email,
        "username": username,
        "full_name": "Smoke Test",
        "password": "Test@1234"
    })
    print(f"[2] Signup: {r.status_code}")
    if r.status_code == 201:
        print(f"    User created: {r.json().get('username')}")
    else:
        print(f"    Response: {r.text[:300]}")
    assert r.status_code == 201, f"Signup failed: {r.text[:200]}"

    # 3. Login
    r = client.post("/api/auth/login", json={
        "email": email,
        "password": "Test@1234"
    })
    print(f"[3] Login: {r.status_code}")
    if r.status_code != 200:
        print(f"    Error: {r.text[:300]}")
    assert r.status_code == 200, f"Login failed: {r.text[:200]}"
    data = r.json()
    token = data["access_token"]
    print(f"    Token: {token[:40]}...")
    headers = {"Authorization": f"Bearer {token}"}

    # 4. Get profile
    r = client.get("/api/users/me", headers=headers)
    print(f"[4] Profile: {r.status_code} -> username={r.json().get('username')}")
    assert r.status_code == 200

    # 5. List courses (empty)
    r = client.get("/api/courses")
    print(f"[5] Courses: {r.status_code} -> total={r.json().get('total', 0)}")
    assert r.status_code == 200

    # 6. Get analytics
    r = client.get("/api/analytics/dashboard", headers=headers)
    print(f"[6] Analytics: {r.status_code}")
    assert r.status_code == 200

    # 7. Coding problems (empty)
    r = client.get("/api/coding/problems")
    print(f"[7] Problems: {r.status_code} -> total={r.json().get('total', 0)}")
    assert r.status_code == 200

    # 8. Notes (empty)
    r = client.get("/api/notes", headers=headers)
    print(f"[8] Notes: {r.status_code} -> count={len(r.json())}")
    assert r.status_code == 200

    # 9. Flashcards (empty)
    r = client.get("/api/flashcards", headers=headers)
    print(f"[9] Flashcards: {r.status_code} -> count={len(r.json())}")
    assert r.status_code == 200

    # 10. Certificates (empty)
    r = client.get("/api/certificates", headers=headers)
    print(f"[10] Certificates: {r.status_code} -> count={len(r.json())}")
    assert r.status_code == 200

    # 11. Announcements (empty)
    r = client.get("/api/admin/announcements")
    print(f"[11] Announcements: {r.status_code}")
    assert r.status_code == 200

    # 12. Logout
    r = client.post("/api/auth/logout", headers=headers)
    print(f"[12] Logout: {r.status_code} -> {r.json().get('message')}")
    assert r.status_code == 200

    print("\n=== ALL 12 SMOKE TESTS PASSED ===")

if __name__ == "__main__":
    test()
