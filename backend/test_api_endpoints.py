"""
Test the actual API endpoints to see what's being returned
"""
import requests
import json

BASE_URL = "http://localhost:5000"

# First, login as senate to get a token
print("=" * 80)
print("Testing Dashboard API Endpoints")
print("=" * 80)

# Login
print("\n1. Logging in as senate...")
login_data = {
    "username": "senate",
    "password": "senate123"
}

try:
    response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
    if response.status_code == 200:
        token = response.json().get('access_token')
        print(f"✓ Login successful")
        print(f"Token: {token[:50]}...")
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        # Test grades-over-time
        print("\n2. Testing /api/dashboard/grades-over-time...")
        response = requests.get(f"{BASE_URL}/api/dashboard/grades-over-time", headers=headers)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Keys: {list(data.keys())}")
            if data.get('periods'):
                print(f"Periods: {data['periods'][:5]}")
                print(f"Grades: {data['grades'][:5]}")
            else:
                print("No periods returned!")
                print(f"Full response: {json.dumps(data, indent=2)}")
        else:
            print(f"Error: {response.text}")
        
        # Test attendance-trends
        print("\n3. Testing /api/dashboard/attendance-trends...")
        response = requests.get(f"{BASE_URL}/api/dashboard/attendance-trends", headers=headers)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Keys: {list(data.keys())}")
            if data.get('periods'):
                print(f"Periods: {data['periods'][:5]}")
                print(f"Attendance: {data['attendance'][:5]}")
            else:
                print("No periods returned!")
                print(f"Full response: {json.dumps(data, indent=2)}")
        else:
            print(f"Error: {response.text}")
        
        # Test payment-trends
        print("\n4. Testing /api/dashboard/payment-trends...")
        response = requests.get(f"{BASE_URL}/api/dashboard/payment-trends", headers=headers)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Keys: {list(data.keys())}")
            if data.get('periods'):
                print(f"Periods: {data['periods'][:5]}")
                print(f"Amounts: {data['amounts'][:5]}")
            else:
                print("No periods returned!")
                print(f"Full response: {json.dumps(data, indent=2)}")
        else:
            print(f"Error: {response.text}")
            
    else:
        print(f"✗ Login failed: {response.status_code}")
        print(f"Response: {response.text}")
        
except requests.exceptions.ConnectionError:
    print("✗ Cannot connect to backend server!")
    print("Make sure the backend is running on http://localhost:5000")
except Exception as e:
    print(f"✗ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 80)


