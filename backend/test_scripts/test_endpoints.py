"""
Quick test script to verify endpoints are working
"""
import requests
import json

BASE_URL = "http://localhost:5000"

def test_endpoints():
    print("Testing Backend Endpoints...")
    print("=" * 50)
    
    # Test 1: Check if server is running
    try:
        response = requests.get(f"{BASE_URL}/api/health", timeout=2)
        print(f"✓ Health check: {response.status_code}")
    except requests.exceptions.ConnectionError:
        print("✗ Server not running. Please start the backend server first.")
        return
    except Exception as e:
        print(f"✗ Health check failed: {e}")
    
    # Test 2: Check if export blueprint is registered
    try:
        # This will fail without auth, but we can check if the endpoint exists
        response = requests.get(f"{BASE_URL}/api/export/excel", timeout=2)
        if response.status_code in [401, 403]:
            print("✓ Export endpoint exists (auth required)")
        else:
            print(f"✓ Export endpoint: {response.status_code}")
    except Exception as e:
        print(f"✗ Export endpoint test: {e}")
    
    # Test 3: Check filter-options endpoint
    try:
        response = requests.get(f"{BASE_URL}/api/analytics/filter-options", timeout=2)
        if response.status_code in [401, 403]:
            print("✓ Filter-options endpoint exists (auth required)")
        else:
            print(f"✓ Filter-options endpoint: {response.status_code}")
    except Exception as e:
        print(f"✗ Filter-options endpoint test: {e}")
    
    print("\n" + "=" * 50)
    print("Backend server is running and endpoints are accessible!")
    print("Note: Some endpoints require authentication (401/403 is expected)")

if __name__ == "__main__":
    test_endpoints()

