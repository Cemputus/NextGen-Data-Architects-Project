"""
Test FEX Analytics API endpoint
"""
import requests
import json

def test_fex_api():
    base_url = "http://localhost:5000"
    
    # Test login first
    print("Testing login...")
    login_response = requests.post(f"{base_url}/api/auth/login", json={
        "identifier": "dean",
        "password": "dean123"
    })
    
    if login_response.status_code != 200:
        print(f"Login failed: {login_response.status_code}")
        print(login_response.text)
        return
    
    token = login_response.json()['access_token']
    headers = {"Authorization": f"Bearer {token}"}
    
    print("\n" + "=" * 60)
    print("TESTING FEX ANALYTICS API")
    print("=" * 60)
    
    # Test without filters
    print("\n1. Testing FEX Analytics (no filters)...")
    response = requests.get(f"{base_url}/api/analytics/fex", headers=headers)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Data rows: {len(data.get('data', []))}")
        print(f"Summary: {json.dumps(data.get('summary', {}), indent=2)}")
    else:
        print(f"Error: {response.text}")
    
    # Test with drilldown
    print("\n2. Testing FEX Analytics (drilldown=faculty)...")
    response = requests.get(f"{base_url}/api/analytics/fex?drilldown=faculty", headers=headers)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Data rows: {len(data.get('data', []))}")
        if data.get('data'):
            print(f"Sample row: {json.dumps(data['data'][0] if data['data'] else {}, indent=2)}")
    else:
        print(f"Error: {response.text}")

if __name__ == '__main__':
    test_fex_api()



