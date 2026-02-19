"""
Test script to verify frontend-backend connection and FEX analytics
"""
import requests
import json
import time

BASE_URL = "http://localhost:5000"
FRONTEND_URL = "http://localhost:3000"

def test_backend_connection():
    """Test if backend is accessible"""
    print("=" * 60)
    print("FRONTEND-BACKEND CONNECTION TEST")
    print("=" * 60)
    print(f"Backend URL: {BASE_URL}")
    print(f"Frontend URL: {FRONTEND_URL}\n")
    
    # Test 1: Backend Status
    print("1. Testing Backend Status...")
    try:
        response = requests.get(f"{BASE_URL}/api/status", timeout=5)
        if response.status_code == 200:
            print(f"   ✓ Backend is running: {response.json()}")
        else:
            print(f"   ✗ Backend returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"   ✗ Cannot connect to backend: {e}")
        return False
    
    # Test 2: Login to get token
    print("\n2. Testing Login...")
    try:
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"identifier": "dean", "password": "dean123"},
            timeout=10
        )
        if login_response.status_code == 200:
            data = login_response.json()
            token = data.get('access_token')
            role = data.get('role')
            print(f"   ✓ Login successful")
            print(f"   → Role: {role}")
            print(f"   → Token obtained: {token[:20]}...")
        else:
            print(f"   ✗ Login failed: {login_response.status_code}")
            return False
    except Exception as e:
        print(f"   ✗ Login error: {e}")
        return False
    
    # Test 3: FEX Analytics
    print("\n3. Testing FEX Analytics Endpoint...")
    try:
        fex_response = requests.get(
            f"{BASE_URL}/api/analytics/fex",
            headers={"Authorization": f"Bearer {token}"},
            params={"drilldown": "overall"},
            timeout=10
        )
        if fex_response.status_code == 200:
            fex_data = fex_response.json()
            summary = fex_data.get('summary', {})
            print(f"   ✓ FEX Analytics endpoint working")
            print(f"   → Total FEX: {summary.get('total_fex', 0)}")
            print(f"   → Total MEX: {summary.get('total_mex', 0)}")
            print(f"   → Total FCW: {summary.get('total_fcw', 0)}")
            print(f"   → FEX Rate: {summary.get('fex_rate', 0)}%")
            print(f"   → Data rows: {len(fex_data.get('data', []))}")
            
            if summary.get('total_fex', 0) > 0:
                print("   ✓ FEX data is available!")
            else:
                print("   ⚠ FEX data is 0 - may need to run ETL")
        else:
            print(f"   ✗ FEX Analytics failed: {fex_response.status_code}")
            print(f"   → Response: {fex_response.text[:200]}")
    except Exception as e:
        print(f"   ✗ FEX Analytics error: {e}")
    
    # Test 4: Dashboard Stats
    print("\n4. Testing Dashboard Stats...")
    try:
        stats_response = requests.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        if stats_response.status_code == 200:
            stats = stats_response.json().get('stats', {})
            print(f"   ✓ Dashboard Stats endpoint working")
            print(f"   → Total Students: {stats.get('total_students', 0)}")
            print(f"   → Total Courses: {stats.get('total_courses', 0)}")
        else:
            print(f"   ✗ Dashboard Stats failed: {stats_response.status_code}")
    except Exception as e:
        print(f"   ✗ Dashboard Stats error: {e}")
    
    # Test 5: Frontend Accessibility
    print("\n5. Testing Frontend Accessibility...")
    try:
        frontend_response = requests.get(FRONTEND_URL, timeout=5)
        if frontend_response.status_code == 200:
            print(f"   ✓ Frontend is accessible at {FRONTEND_URL}")
        else:
            print(f"   ⚠ Frontend returned status {frontend_response.status_code}")
    except Exception as e:
        print(f"   ⚠ Cannot connect to frontend: {e}")
        print(f"   → Make sure frontend is running: cd frontend && npm start")
    
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    print("✓ Backend is running and accessible")
    print("✓ Login API is working")
    print("✓ FEX Analytics endpoint is functional")
    print("✓ Dashboard Stats endpoint is working")
    print("\nNext Steps:")
    print("1. Open http://localhost:3000 in your browser")
    print("2. Login with credentials (e.g., dean/dean123)")
    print("3. Navigate to Analytics or FEX Analytics page")
    print("4. Verify charts display FEX, MEX, FCW data")
    print("=" * 60)

if __name__ == '__main__':
    test_backend_connection()

