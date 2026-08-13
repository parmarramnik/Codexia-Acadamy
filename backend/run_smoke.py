"""Comprehensive smoke test for AI Learning Management System API Gateway & Microservices."""
import httpx
import json
import uuid

BASE = "http://localhost:8000"
client = httpx.Client(base_url=BASE, timeout=15)

def test():
    # 1. Health check
    r = client.get("/api/health")
    print(f"[1] Health Check: {r.status_code} -> {r.json().get('status')}")
    assert r.status_code == 200

    # 2. Test pre-seeded accounts for all 4 roles
    roles_to_test = [
        ("student@gmail.com", "123456", "student"),
        ("instructor@gmail.com", "123456", "instructor"),
        ("admin@gmail.com", "123456", "admin"),
        ("sadmin@gmail.com", "123456", "super_admin"),
    ]

    print("\n--- Testing Pre-seeded User Roles ---")
    tokens = {}
    for email, pwd, expected_role in roles_to_test:
        r = client.post("/api/auth/login", json={"email": email, "password": pwd})
        print(f"Login ({email}): status {r.status_code}")
        assert r.status_code == 200, f"Login failed for {email}: {r.text}"
        data = r.json()
        token = data["access_token"]
        user_role = data["user"]["role"]
        print(f"  -> Verified Role: {user_role}")
        assert user_role == expected_role, f"Expected role {expected_role}, got {user_role}"
        tokens[expected_role] = token

    # 3. Test Student Features
    print("\n--- Testing Student Features ---")
    headers_student = {"Authorization": f"Bearer {tokens['student']}"}
    
    r = client.get("/api/courses", headers=headers_student)
    print(f"Courses list: {r.status_code}")
    assert r.status_code == 200

    r = client.get("/api/coding/problems", headers=headers_student)
    print(f"Coding problems: {r.status_code}")
    assert r.status_code == 200

    r = client.get("/api/analytics/dashboard", headers=headers_student)
    print(f"Analytics dashboard: {r.status_code}")
    assert r.status_code == 200

    r = client.get("/api/notes", headers=headers_student)
    print(f"Notes: {r.status_code}")
    assert r.status_code == 200

    # 4. Test Admin & Super Admin RBAC endpoints
    print("\n--- Testing Admin & Super Admin Executive Endpoints ---")
    headers_admin = {"Authorization": f"Bearer {tokens['admin']}"}
    headers_sadmin = {"Authorization": f"Bearer {tokens['super_admin']}"}

    r = client.get("/api/admin/dashboard/stats", headers=headers_admin)
    print(f"Admin Stats (/api/admin/dashboard/stats): {r.status_code}")
    assert r.status_code == 200, f"Admin stats failed: {r.text}"

    r = client.get("/api/admin/dashboard/stats", headers=headers_sadmin)
    print(f"Super Admin Stats (/api/admin/dashboard/stats): {r.status_code}")
    assert r.status_code == 200, f"Super admin stats failed: {r.text}"

    r = client.get("/api/admin/users", headers=headers_sadmin)
    print(f"Super Admin User List (/api/admin/users): {r.status_code}")
    assert r.status_code == 200, f"Super admin users failed: {r.text}"

    # 5. Dynamic signup test
    print("\n--- Testing Dynamic User Registration & Auth ---")
    uid = uuid.uuid4().hex[:6]
    dyn_email = f"dynamic{uid}@test.com"
    r = client.post("/api/auth/signup", json={
        "email": dyn_email,
        "username": f"dyn{uid}",
        "full_name": "Dynamic User",
        "password": "TestPassword123!"
    })
    print(f"Dynamic Signup: {r.status_code}")
    assert r.status_code == 201

    print("\n==========================================")
    print("  ALL SYSTEM INTEGRITY & API TESTS PASSED!  ")
    print("==========================================")

if __name__ == "__main__":
    test()
