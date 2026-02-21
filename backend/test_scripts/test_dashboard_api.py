"""Test dashboard API endpoints"""
import requests
import json

BASE_URL = "http://localhost:5000"

# Test login first
print("=" * 70)
print("TESTING DASHBOARD API")
print("=" * 70)

# 1. Login as senate (or any admin user)
print("\n1. LOGGING IN...")
login_data = {
    "identifier": "senate",  # or "dean", "hod", etc.
    "password": "senate123"  # adjust password as needed
}

try:
    login_response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
    if login_response.status_code == 200:
        token = login_response.json()['access_token']
        print(f"   ✓ Login successful")
        print(f"   Token: {token[:50]}...")
    else:
        print(f"   ✗ Login failed: {login_response.status_code}")
        print(f"   Response: {login_response.text}")
        print("\n   Try logging in with different credentials:")
        print("   - senate / senate123")
        print("   - dean / dean123")
        print("   - hod / hod123")
        exit(1)
except Exception as e:
    print(f"   ✗ Connection error: {e}")
    print(f"\n   Make sure the backend server is running!")
    print(f"   Run: python start_server.py")
    exit(1)

# 2. Test dashboard stats
print("\n2. TESTING /api/dashboard/stats...")
headers = {"Authorization": f"Bearer {token}"}
try:
    stats_response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
    if stats_response.status_code == 200:
        stats = stats_response.json()
        print(f"   ✓ Stats retrieved successfully")
        print(f"   Total Students: {stats.get('total_students', 0)}")
        print(f"   Total High Schools: {stats.get('total_high_schools', 0)}")
        print(f"   Avg Retention Rate: {stats.get('avg_retention_rate', 0)}%")
        print(f"   Avg Graduation Rate: {stats.get('avg_graduation_rate', 0)}%")
    else:
        print(f"   ✗ Stats failed: {stats_response.status_code}")
        print(f"   Response: {stats_response.text}")
except Exception as e:
    print(f"   ✗ Error: {e}")

# 3. Test students-by-department
print("\n3. TESTING /api/dashboard/students-by-department...")
try:
    dept_response = requests.get(f"{BASE_URL}/api/dashboard/students-by-department", headers=headers)
    if dept_response.status_code == 200:
        dept_data = dept_response.json()
        print(f"   ✓ Department data retrieved")
        if isinstance(dept_data, dict) and 'departments' in dept_data:
            print(f"   Departments: {len(dept_data.get('departments', []))}")
        elif isinstance(dept_data, list):
            print(f"   Departments: {len(dept_data)}")
        else:
            print(f"   Data: {json.dumps(dept_data, indent=2)[:200]}")
    else:
        print(f"   ✗ Failed: {dept_response.status_code}")
        print(f"   Response: {dept_response.text}")
except Exception as e:
    print(f"   ✗ Error: {e}")

# 4. Test grades-over-time
print("\n4. TESTING /api/dashboard/grades-over-time...")
try:
    grades_response = requests.get(f"{BASE_URL}/api/dashboard/grades-over-time", headers=headers)
    if grades_response.status_code == 200:
        grades_data = grades_response.json()
        print(f"   ✓ Grades data retrieved")
        if isinstance(grades_data, dict):
            print(f"   Keys: {list(grades_data.keys())}")
        else:
            print(f"   Data type: {type(grades_data)}")
    else:
        print(f"   ✗ Failed: {grades_response.status_code}")
        print(f"   Response: {grades_response.text}")
except Exception as e:
    print(f"   ✗ Error: {e}")

print("\n" + "=" * 70)
print("TEST COMPLETE")
print("=" * 70)


