"""
Start the Flask server.

Run inside the project venv:
  Windows:  backend\\venv\\Scripts\\activate  then  python start_server.py
  Linux/Mac: source backend/venv/bin/activate  then  python start_server.py
  Or use: run_backend.bat (Windows) / run_backend.sh (Linux/Mac)
"""
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app import app

# Confirm User Management API is registered (frontend uses /api/user-mgmt/)
_um_rules = [r.rule for r in app.url_map.iter_rules() if '/api/user-mgmt/' in r.rule]
if not any('users' in r for r in _um_rules):
    print("WARNING: User Management routes missing! Update app.py and restart.")
else:
    print("OK: User Management at /api/user-mgmt/users, /api/user-mgmt/faculties, /api/user-mgmt/departments, /api/user-mgmt/ping")

if __name__ == '__main__':
    print("="*80)
    print("Starting NextGen Data Architects Backend Server")
    print("="*80)
    print("Server: http://127.0.0.1:5000")
    print("Test in browser: http://127.0.0.1:5000/api/user-mgmt/ping  (expect {\"ok\":true})")
    print("Press Ctrl+C to stop the server")
    print("="*80)
    try:
        app.run(debug=True, host='0.0.0.0', port=5000, use_reloader=False)
    except KeyboardInterrupt:
        print("\nServer stopped by user")
    except Exception as e:
        print(f"\nError starting server: {e}")
        import traceback
        traceback.print_exc()

