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

if __name__ == '__main__':
    print("="*80)
    print("Starting NextGen Data Architects Backend Server")
    print("="*80)
    print("Server: http://127.0.0.1:5000  (frontend uses this URL)")
    print("Test: http://127.0.0.1:5000/api/admin/ping")
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

