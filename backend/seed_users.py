import os
import sys
from sqlalchemy import create_engine, text
from pathlib import Path

# Provide standard bcrypt hash fallback or just passlib hash
import bcrypt

def seed_users():
    from config import DATA_WAREHOUSE_CONN_STRING
    
    # We will connect to the data warehouse to fetch valid faculties and departments
    dw_engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
    
    rbac_conn = DATA_WAREHOUSE_CONN_STRING.replace('ucu_datawarehouse', 'ucu_rbac')
    rbac_engine = create_engine(rbac_conn)

    password_hash = bcrypt.hashpw("ChangeMe123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    try:
        with dw_engine.connect() as conn:
            # Fetch faculties
            faculties_rs = conn.execute(text("SELECT faculty_id, faculty_name FROM dim_faculty"))
            faculties = {row[1].lower(): row[0] for row in faculties_rs}
            
            # Fetch departments
            depts_rs = conn.execute(text("SELECT department_id, department_name, faculty_id FROM dim_department"))
            departments = {row[1].lower(): (row[0], row[2]) for row in depts_rs}
            
            # Helper to find dept and faculty ids by name substring
            def find_dept_ids(name_part):
                for k, v in departments.items():
                    if name_part.lower() in k:
                        return v[0], v[1] # department_id, faculty_id
                return None, None
                
            def find_fac_id(name_part):
                for k, v in faculties.items():
                    if name_part.lower() in k:
                        return v
                return None

            users = [
                # Institution wide
                ('senate.member', 'senate', 'Senate Member', None, None),
                ('finance.mgr', 'finance', 'Finance Manager', None, None),
                ('hr.mgr', 'hr', 'HR Manager', None, None),
                ('admin2', 'sysadmin', 'System Admin', None, None),
                ('analyst1', 'analyst', 'Data Analyst 1', None, None),
                ('analyst2', 'analyst', 'Data Analyst 2', None, None),
            ]
            
            # Deans
            fac_foc = find_fac_id('computing')
            fac_fob = find_fac_id('business')
            fac_foe = find_fac_id('engineering')
            
            users.extend([
                ('dean.foc', 'dean', 'Dean FOC', fac_foc, None),
                ('dean.fob', 'dean', 'Dean FOB', fac_fob, None),
                ('dean.foe', 'dean', 'Dean FOE', fac_foe, None),
            ])
            
            # HODs
            dept_ids = {
                'cs': find_dept_ids('computer science'),
                'it': find_dept_ids('information technology'),
                'ai': find_dept_ids('data science') or find_dept_ids('ai'), 
                'acc': find_dept_ids('accounting'),
                'bba': find_dept_ids('business admin'),
            }
            
            for dept_code, (d_id, f_id) in dept_ids.items():
                if d_id:
                    users.append((f'hod.{dept_code}', 'hod', f'HOD {dept_code.upper()}', f_id, d_id))
                    # Add 4-5 lecturers per department
                    for i in range(1, 6):
                        users.append((f'lec.{dept_code}{i}', 'staff', f'Lecturer {i} {dept_code.upper()}', f_id, d_id))

        with rbac_engine.connect() as rbac_conn_db:
            rbac_conn_db = rbac_conn_db.execution_options(autocommit=True)
            
            # Reset identity sequence to prevent PK collisions if manual entries exist
            try:
                rbac_conn_db.execute(text("SELECT setval('app_users_id_seq', (SELECT COALESCE(MAX(id), 0) FROM app_users) + 1, false)"))
            except:
                pass

            for username, role, full_name, fac_id, dept_id in users:
                # Check if exists
                res = rbac_conn_db.execute(text("SELECT id FROM app_users WHERE username=:u"), {"u": username}).fetchone()
                if not res:
                    rbac_conn_db.execute(
                        text("""
                        INSERT INTO app_users (username, password_hash, role, full_name, faculty_id, department_id)
                        VALUES (:u, :p, :r, :fn, :f, :d)
                        """),
                        {
                            "u": username,
                            "p": password_hash,
                            "r": role,
                            "fn": full_name,
                            "f": fac_id,
                            "d": dept_id
                        }
                    )
                    print(f"Created user: {username} ({role})")
                else:
                    rbac_conn_db.execute(
                        text("""
                        UPDATE app_users 
                        SET role=:r, full_name=:fn, faculty_id=:f, department_id=:d 
                        WHERE username=:u
                        """),
                        {
                            "u": username,
                            "r": role,
                            "fn": full_name,
                            "f": fac_id,
                            "d": dept_id
                        }
                    )
                    print(f"Updated user: {username} ({role})")
                    
        print("User seeding completed successfully.")
        
    except Exception as e:
        print(f"Error seeding users: {e}")

if __name__ == '__main__':
    seed_users()
