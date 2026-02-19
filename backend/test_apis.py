"""
Quick API test script to verify all endpoints work correctly
"""
import requests
import json
import sys

BASE_URL = "http://localhost:5000"

def test_endpoint(name, method, url, headers=None, data=None, expected_status=200):
    """Test a single API endpoint"""
    try:
        if method == 'GET':
            response = requests.get(url, headers=headers, timeout=10)
        elif method == 'POST':
            response = requests.post(url, headers=headers, json=data, timeout=10)
        else:
            return False, f"Unsupported method: {method}"
        
        # Handle expected_status as list or single value
        if isinstance(expected_status, list):
            is_expected = response.status_code in expected_status
        else:
            is_expected = response.status_code == expected_status
        
        if is_expected:
            return True, f"✓ {name}: Status {response.status_code}"
        else:
            try:
                error_data = response.json()
                return False, f"✗ {name}: Status {response.status_code} - {error_data.get('error', 'Unknown error')}"
            except:
                return False, f"✗ {name}: Status {response.status_code} - {response.text[:100]}"
    except requests.exceptions.ConnectionError:
        return False, f"✗ {name}: Cannot connect to backend. Is the server running on {BASE_URL}?"
    except requests.exceptions.Timeout:
        return False, f"✗ {name}: Request timed out"
    except Exception as e:
        return False, f"✗ {name}: {str(e)}"

def main():
    print("=" * 60)
    print("API ENDPOINT TESTING")
    print("=" * 60)
    print(f"Testing against: {BASE_URL}\n")
    
    results = []
    
    # Test 1: Backend status
    print("1. Testing Backend Status...")
    success, msg = test_endpoint("Backend Status", "GET", f"{BASE_URL}/api/status")
    print(f"   {msg}")
    results.append((success, msg))
    if not success:
        print("\n⚠ Backend server is not running. Please start it first.")
        print("   Options:")
        print("   1. Run: start_backend.bat")
        print("   2. Run: .venv\\Scripts\\python.exe start_server.py")
        print("   3. Run: python start_server.py (with venv activated)")
        print("\n   The server should show: 'Running on http://0.0.0.0:5000'")
        return
    
    # Test 2: Login (Dean)
    print("\n2. Testing Login (Dean)...")
    login_data = {"identifier": "dean", "password": "dean123"}
    success, msg = test_endpoint("Login", "POST", f"{BASE_URL}/api/auth/login", data=login_data, expected_status=200)
    print(f"   {msg}")
    results.append((success, msg))
    
    if not success:
        print("\n⚠ Login failed. Cannot test authenticated endpoints.")
        return
    
    # Get token from login
    try:
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data, timeout=10)
        if login_response.status_code == 200:
            token = login_response.json().get('access_token')
            headers = {"Authorization": f"Bearer {token}"}
            print(f"   ✓ Token obtained: {token[:20]}...")
        else:
            print("   ✗ Could not get token")
            return
    except Exception as e:
        print(f"   ✗ Error getting token: {e}")
        return
    
    # Test 3: Dashboard Stats
    print("\n3. Testing Dashboard Stats...")
    success, msg = test_endpoint("Dashboard Stats", "GET", f"{BASE_URL}/api/dashboard/stats", headers=headers)
    print(f"   {msg}")
    if success:
        try:
            stats = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers, timeout=10).json()
            print(f"   → Total Students: {stats.get('total_students', 'N/A')}")
            print(f"   → Total Courses: {stats.get('total_courses', 'N/A')}")
        except:
            pass
    results.append((success, msg))
    
    # Test 4: FEX Analytics
    print("\n4. Testing FEX Analytics...")
    success, msg = test_endpoint("FEX Analytics", "GET", f"{BASE_URL}/api/analytics/fex", headers=headers)
    print(f"   {msg}")
    if success:
        try:
            fex_data = requests.get(f"{BASE_URL}/api/analytics/fex", headers=headers, timeout=10).json()
            summary = fex_data.get('summary', {})
            print(f"   → Total FEX: {summary.get('total_fex', 0)}")
            print(f"   → Total MEX: {summary.get('total_mex', 0)}")
            print(f"   → Total FCW: {summary.get('total_fcw', 0)}")
            print(f"   → FEX Rate: {summary.get('fex_rate', 0)}%")
            print(f"   → Data rows: {len(fex_data.get('data', []))}")
        except Exception as e:
            print(f"   ⚠ Error parsing response: {e}")
    results.append((success, msg))
    
    # Test 5: Students by Department
    print("\n5. Testing Students by Department...")
    success, msg = test_endpoint("Students by Department", "GET", f"{BASE_URL}/api/dashboard/students-by-department", headers=headers)
    print(f"   {msg}")
    results.append((success, msg))
    
    # Test 6: Grades Over Time
    print("\n6. Testing Grades Over Time...")
    success, msg = test_endpoint("Grades Over Time", "GET", f"{BASE_URL}/api/dashboard/grades-over-time", headers=headers)
    print(f"   {msg}")
    results.append((success, msg))
    
    # Test 7: Payment Status
    print("\n7. Testing Payment Status...")
    success, msg = test_endpoint("Payment Status", "GET", f"{BASE_URL}/api/dashboard/payment-status", headers=headers)
    print(f"   {msg}")
    results.append((success, msg))
    
    # Test 8: Filter Options
    print("\n8. Testing Filter Options...")
    success, msg = test_endpoint("Filter Options", "GET", f"{BASE_URL}/api/analytics/filter-options", headers=headers)
    print(f"   {msg}")
    results.append((success, msg))
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    passed = sum(1 for s, _ in results if s)
    total = len(results)
    print(f"Passed: {passed}/{total}")
    print(f"Failed: {total - passed}/{total}\n")
    
    if passed == total:
        print("✓ All API endpoints are working correctly!")
    else:
        print("⚠ Some endpoints failed. Check the errors above.")
        for success, msg in results:
            if not success:
                print(f"  - {msg}")

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
    except Exception as e:
        print(f"\n\nUnexpected error: {e}")
        import traceback
        traceback.print_exc()
