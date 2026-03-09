#!/usr/bin/env python3
"""
Reset ALL app_users passwords to a known value so everyone can log in.
Run from backend: python reset_all_app_passwords.py

After running, every app user can log in with password: ChangeMe123
"""
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

PASSWORD = "ChangeMe123"

def main():
    try:
        from config import PG_HOST, PG_PORT, PG_USER, PG_PASSWORD
        from werkzeug.security import generate_password_hash
        import psycopg2
    except ImportError as e:
        print(f"ERROR: {e}. Run from backend with: python reset_all_app_passwords.py")
        return

    ph = generate_password_hash(PASSWORD, method="pbkdf2:sha256")
    conn = psycopg2.connect(
        host=PG_HOST, port=int(PG_PORT), user=PG_USER, password=PG_PASSWORD or "",
        dbname="ucu_rbac"
    )
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE app_users SET password_hash = %s", (ph,))
            n = cur.rowcount
        conn.commit()
        print(f"Done. Reset {n} app user(s). All can now log in with password: {PASSWORD}")
    except Exception as e:
        print(f"ERROR: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    main()
