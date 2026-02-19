"""
Test all user logins to verify they work
"""
import requests
import json

BASE_URL = "http://localhost:5000"

# Test all user types
test_users = [
    ('admin', 'admin123', 'sysadmin'),
    ('analyst', 'analyst123', 'analyst'),
    ('senate', 'senate123', 'senate'),
    ('staff', 'staff123', 'staff'),
    ('dean', 'dean123', 'dean'),
    ('hod', 'hod123', 'hod'),
    ('hr', 'hr123', 'hr'),
    ('finance', 'finance123', 'finance'),
    ('A26143', 'A26143@ucu', 'student'),  # Student with Access Number
]

print("="*80)
print("TESTING ALL USER LOGINS")
print("="*80)
print()

all_passed = True

for username, password, expected_role in test_users:
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"identifier": username, "password": password},
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            role = data.get('role') or (data.get('user', {}).get('role') if data.get('user') else None)
            
            if role == expected_role:
                print(f"✓ {username:15} ({expected_role:10}): SUCCESS - Role: {role}")
            else:
                print(f"✗ {username:15} ({expected_role:10}): FAILED - Expected: {expected_role}, Got: {role}")
                all_passed = False
        else:
            print(f"✗ {username:15} ({expected_role:10}): FAILED - Status: {response.status_code}, Error: {response.text[:100]}")
            all_passed = False
    except Exception as e:
        print(f"✗ {username:15} ({expected_role:10}): ERROR - {str(e)}")
        all_passed = False

print()
print("="*80)
if all_passed:
    print("✓ ALL LOGINS PASSED!")
else:
    print("✗ SOME LOGINS FAILED")
print("="*80)


