import requests
import json

BASE_URL = "http://localhost:8000/api"

def run_tests():
    print("=== STARTING END-TO-END AI ROUTE VALIDATIONS ===")
    
    # 1. Setup - register a clean test account
    reg_url = f"{BASE_URL}/auth/signup"
    reg_payload = {
        "email": "teststudent@codexia.edu",
        "username": "teststudent",
        "password": "Password123!@#",
        "full_name": "Test Student"
    }
    
    login_url = f"{BASE_URL}/auth/login"
    login_payload = {
        "email": "teststudent@codexia.edu",
        "password": "Password123!@#",
        "remember_me": True
    }
    
    try:
        # Try registering first (in case it doesn't exist)
        reg_res = requests.post(reg_url, json=reg_payload)
        if reg_res.status_code == 201:
            print("✓ Registered new test account successfully!")
        else:
            print(f"[Setup Info] Registration returned {reg_res.status_code} (User probably already exists).")
        
        # Log in
        res = requests.post(login_url, json=login_payload)
        if res.status_code != 200:
            print("❌ Login failed:", res.text)
            return
            
        tokens = res.json()
        token = tokens["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("✓ Authentication token retrieved successfully!")
    except Exception as e:
        print(f"❌ Auth setup failure: {str(e)}")
        return

    # 2. Test AI Tutor Chat
    tutor_url = f"{BASE_URL}/ai/tutor/chat"
    params = {
        "message": "Explain recursion with time complexity",
        "session_token": "test_tutor_session"
    }
    try:
        res = requests.post(tutor_url, headers=headers, params=params)
        print(f"Tutor response status: {res.status_code}")
        if res.status_code == 200:
            data = res.json()
            print("Tutor Reply Sample:", data.get("reply")[:150], "...")
            print("✓ AI Tutor Chat Route works perfectly!")
        else:
            print("❌ Tutor Chat failed:", res.text)
    except Exception as e:
        print(f"❌ Tutor Chat Error: {str(e)}")



    # 4. Test Resume Analyzer
    resume_url = f"{BASE_URL}/ai/career/resume"
    try:
        res = requests.post(resume_url, headers=headers, data={"resume_text": "Experienced Python developer with React skills."})
        print(f"Resume Analysis status: {res.status_code}")
        if res.status_code == 200:
            data = res.json()
            print("Resume audit score:", data.get("score"))
            print("Recommendations count:", len(data.get("recommended_courses", [])))
            print("✓ AI Resume Analyzer works perfectly!")
        else:
            print("❌ Resume Analyzer failed:", res.text)
    except Exception as e:
        print(f"❌ Resume Error: {str(e)}")

    # 5. Test Study Planner
    planner_url = f"{BASE_URL}/ai/planner/weekly"
    try:
        res = requests.post(planner_url, headers=headers, params={"course_title": "React Frontend", "hours_weekly": 10})
        print(f"Planner status: {res.status_code}")
        if res.status_code == 200:
            data = res.json()
            print("Generated Schedule Days:", len(data.get("schedule", [])))
            print("✓ AI Planner works perfectly!")
        else:
            print("❌ Planner failed:", res.text)
    except Exception as e:
        print(f"❌ Planner Error: {str(e)}")

if __name__ == "__main__":
    run_tests()
