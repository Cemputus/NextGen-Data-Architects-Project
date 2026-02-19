"""
Start the Flask server
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
    print("Server: http://localhost:5000")
    print("User Management API: http://localhost:5000/api/sysadmin/ping (test in browser)")
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

