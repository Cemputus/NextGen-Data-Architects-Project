"""Test dashboard chart endpoints specifically as analyst user."""
import requests

BASE_URL = "http://localhost:5000"

print("=" * 70)
print("TESTING DASHBOARD API AS ANALYST")
print("=" * 70)

print("\n1. LOGGING IN AS analyst ...")
login_data = {"identifier": "analyst", "password": "analyst123"}

try:
    login_response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
    if login_response.status_code == 200:
        token = login_response.json().get("access_token")
        print("   OK Login successful")
        print(f"   Token (first 50 chars): {token[:50]}...")
    else:
        print(f"   FAIL Login failed: {login_response.status_code}")
        print(f"   Response: {login_response.text}")
        raise SystemExit(1)
except Exception as e:
    print(f"   FAIL Connection error: {e}")
    print("   Make sure the backend server is running (python start_server.py)")
    raise SystemExit(1)

headers = {"Authorization": f"Bearer {token}"}

def call_endpoint(name: str, path: str):
    print(f"\n2. TESTING {path}  ({name}) ...")
    try:
        r = requests.get(f"{BASE_URL}{path}", headers=headers)
        print(f"   Status: {r.status_code}")
        try:
            data = r.json()
        except Exception as e:
            print("   JSON error:", e)
            print("   Body:", r.text[:200])
            return
        if isinstance(data, dict):
            for key in list(data.keys())[:6]:
                val = data[key]
                if isinstance(val, list):
                    print(f"   {key}: len={len(val)}")
                else:
                    print(f"   {key}: {val}")
        else:
            print("   Top-level type:", type(data))
    except Exception as e:
        print("   FAIL Error calling endpoint:", e)


for nm, ep in [
    ("students-by-department", "/api/dashboard/students-by-department"),
    ("grades-over-time", "/api/dashboard/grades-over-time"),
    ("attendance-trends", "/api/dashboard/attendance-trends"),
    ("grade-distribution", "/api/dashboard/grade-distribution"),
]:
    call_endpoint(nm, ep)

print("\n" + "=" * 70)
print("ANALYST TEST COMPLETE")
print("=" * 70)

