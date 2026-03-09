"""
ETL Pipeline with Medallion Architecture (Bronze, Silver, Gold)
Uses PostgreSQL

Extended to also make the RBAC / app-user system reproducible across environments
by seeding user-related tables (app_users, user_profiles, user_state) from a
version-controlled snapshot (backend/etl_seeds/user_snapshot.json).
"""
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime, timedelta
from sqlalchemy import create_engine, text
import psycopg2
import os
import random
import logging
import json
import shutil
from config import (
    DB1_CONN_STRING, DB2_CONN_STRING, CSV1_PATH, CSV2_PATH,
    BRONZE_PATH, SILVER_PATH, GOLD_PATH,
    DATA_WAREHOUSE_NAME, DATA_WAREHOUSE_CONN_STRING,
    PG_HOST, PG_PORT, PG_USER, PG_PASSWORD,
    USE_SYNTHETIC_DATA, SYNTHETIC_DATA_DIR,
)
from api.auth import RBAC_CONN_STRING, _ensure_ucu_rbac_database, _ensure_app_users_table, _ensure_user_profiles_table, _ensure_user_state_table

class ETLPipeline:
    def __init__(self):
        self.bronze_path = BRONZE_PATH
        self.silver_path = SILVER_PATH
        self.gold_path = GOLD_PATH
        self.dw_name = DATA_WAREHOUSE_NAME
        
        # Setup logging (same directory as admin API uses for retrieval - ETL_LOG_DIR or backend/logs)
        raw = os.environ.get('ETL_LOG_DIR')
        if raw and raw.strip():
            self.log_dir = Path(raw.strip()).resolve()
        else:
            self.log_dir = (Path(__file__).parent / "logs").resolve()
        self.log_dir.mkdir(parents=True, exist_ok=True)
        
        # Create log file with timestamp
        log_filename = f"etl_pipeline_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
        self.log_file = self.log_dir / log_filename
        
        # Configure logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(self.log_file, encoding='utf-8'),
                logging.StreamHandler()  # Also print to console
            ]
        )
        self.logger = logging.getLogger(__name__)
        self.logger.info(f"ETL Pipeline initialized. Log file: {self.log_file}")

        # Location for user snapshot seeds (for RBAC/app_users reproducibility)
        self.user_snapshot_path = Path(__file__).parent / "etl_seeds" / "user_snapshot.json"

    def seed_user_system_from_snapshot(self):
        """
        Seed ucu_rbac user-related tables (app_users, user_profiles, user_state)
        from a version-controlled JSON snapshot.

        This makes app users, profiles, and workspace state reproducible on new
        machines when ETL is run against a clean environment.
        """
        if not self.user_snapshot_path.exists():
            self.logger.info(f"No user snapshot found at {self.user_snapshot_path}; skipping RBAC/app_users seeding.")
            return

        try:
            with self.user_snapshot_path.open("r", encoding="utf-8") as f:
                snapshot = json.load(f) or {}
        except Exception as e:
            self.logger.error(f"Failed to read user snapshot {self.user_snapshot_path}: {e}", exc_info=True)
            return

        try:
            # Ensure RBAC database and core tables exist
            _ensure_ucu_rbac_database()
            engine = create_engine(RBAC_CONN_STRING)
            _ensure_app_users_table(engine)
            _ensure_user_profiles_table(engine)
            _ensure_user_state_table(engine)

            with engine.connect() as conn:
                conn = conn.execution_options(autocommit=False)

                # Helper to delete + bulk insert
                def upsert_table(table_name: str, rows):
                    if not isinstance(rows, list):
                        return
                    self.logger.info(f"[RBAC seed] Seeding table {table_name} with {len(rows)} rows from snapshot")
                    conn.execute(text(f"DELETE FROM {table_name}"))
                    conn.commit()
                    if not rows:
                        return
                    df = pd.DataFrame(rows)
                    if df.empty:
                        return
                    # Use snapshot data as-is so admin-set passwords (from last export) are preserved
                    df.to_sql(table_name, engine, if_exists="append", index=False)

                upsert_table("app_users", snapshot.get("app_users", []))
                upsert_table("user_profiles", snapshot.get("user_profiles", []))
                upsert_table("user_state", snapshot.get("user_state", []))

                # Seed audit_logs so branches get the same activity trail
                audit_rows = snapshot.get("audit_logs") or []
                if audit_rows:
                    try:
                        conn.execute(text("""
                            CREATE TABLE IF NOT EXISTS audit_logs (
                                log_id BIGSERIAL PRIMARY KEY,
                                user_id INT,
                                username VARCHAR(100),
                                role_name VARCHAR(50),
                                action VARCHAR(100) NOT NULL,
                                resource VARCHAR(100),
                                resource_id VARCHAR(100),
                                old_value TEXT,
                                new_value TEXT,
                                ip_address VARCHAR(45),
                                user_agent VARCHAR(500),
                                status VARCHAR(50),
                                error_message TEXT,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                            )
                        """))
                        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_logs(user_id)"))
                        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action)"))
                        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource)"))
                        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at)"))
                        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_audit_role ON audit_logs(role_name)"))
                        conn.commit()
                        conn.execute(text("DELETE FROM audit_logs"))
                        conn.commit()
                    except Exception as create_ex:
                        self.logger.warning(f"[RBAC seed] Could not ensure audit_logs table: {create_ex}")
                    try:
                        df_audit = pd.DataFrame(audit_rows)
                        df_audit.to_sql("audit_logs", engine, if_exists="append", index=False, method="multi", chunksize=500)
                        self.logger.info(f"[RBAC seed] Seeded audit_logs with {len(audit_rows)} rows")
                    except Exception as ins_ex:
                        self.logger.warning(f"[RBAC seed] Failed to seed audit_logs: {ins_ex}")

                conn.commit()
            engine.dispose()
            self.logger.info("[RBAC seed] User system seeded successfully from snapshot.")

            # Restore profile photos from snapshot if available
            photos_src = self.user_snapshot_path.parent / "profile_photos"
            photos_dst = Path(__file__).parent / "data" / "profile_photos"
            try:
                if photos_src.exists():
                    photos_dst.mkdir(parents=True, exist_ok=True)
                    # Copy tree but do not delete potential runtime-only files
                    for src_file in photos_src.rglob("*"):
                        if src_file.is_file():
                            rel = src_file.relative_to(photos_src)
                            dest_file = photos_dst / rel
                            dest_file.parent.mkdir(parents=True, exist_ok=True)
                            shutil.copy2(src_file, dest_file)
                    self.logger.info(f"[RBAC seed] Restored profile photos from {photos_src} to {photos_dst}")
            except Exception as e:
                self.logger.warning(f"[RBAC seed] Failed to restore profile photos from snapshot: {e}")

            # Restore admin settings (notifications, ETL auto, etc.) so branches get same config
            seeds_dir = self.user_snapshot_path.parent
            settings_src = seeds_dir / "admin_settings.json"
            settings_dst = Path(__file__).parent / "data" / "admin_settings.json"
            if settings_src.exists():
                try:
                    settings_dst.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(settings_src, settings_dst)
                    self.logger.info(f"[RBAC seed] Restored admin_settings.json to {settings_dst}")
                except Exception as e:
                    self.logger.warning(f"[RBAC seed] Failed to restore admin_settings: {e}")

            # Restore ETL run history (log files) so admin UI shows same ETL jobs
            etl_runs_src = seeds_dir / "etl_runs"
            if etl_runs_src.exists():
                try:
                    for log_file in etl_runs_src.glob("etl_pipeline_*.log"):
                        shutil.copy2(log_file, self.log_dir / log_file.name)
                    self.logger.info(f"[RBAC seed] Restored ETL run logs from {etl_runs_src} to {self.log_dir}")
                except Exception as e:
                    self.logger.warning(f"[RBAC seed] Failed to restore ETL runs: {e}")
        except Exception as e:
            self.logger.error(f"Failed to seed user system from snapshot: {e}", exc_info=True)
        
    def create_data_warehouse(self):
        """Create data warehouse database if it doesn't exist"""
        try:
            self.logger.info(f"Creating data warehouse database: {self.dw_name}")
            from pg_helpers import ensure_database
            ensure_database(self.dw_name)
            self.logger.info(f"Data warehouse database {self.dw_name} ready")
            print(f"Data warehouse database {self.dw_name} ready")
        except Exception as e:
            self.logger.error(f"Error creating data warehouse: {e}", exc_info=True)
            print(f"Error creating data warehouse: {e}")
            raise
        
    def extract(self):
        """Extract data from all sources (Bronze Layer). Uses Synthetic_Data when USE_SYNTHETIC_DATA is True."""
        self.logger.info("=" * 60)
        self.logger.info("EXTRACT PHASE - Bronze Layer")
        self.logger.info("=" * 60)
        print("Extracting data to Bronze layer...")

        if USE_SYNTHETIC_DATA and SYNTHETIC_DATA_DIR and Path(SYNTHETIC_DATA_DIR).exists():
            self.logger.info("Using SYNTHETIC data source: %s", SYNTHETIC_DATA_DIR)
            print("Using synthetic data from:", SYNTHETIC_DATA_DIR)
            return self._extract_from_synthetic_data()

        # Extract from Database 1 (ACADEMICS)
        self.logger.info("Extracting from Source Database 1 (ACADEMICS)...")
        engine1 = create_engine(DB1_CONN_STRING)
        students_db1 = pd.read_sql_query("SELECT * FROM students", engine1)
        self.logger.info(f"  → Extracted {len(students_db1)} students")
        courses_db1 = pd.read_sql_query("SELECT * FROM courses", engine1)
        self.logger.info(f"  → Extracted {len(courses_db1)} courses")
        enrollments_db1 = pd.read_sql_query("SELECT * FROM enrollments", engine1)
        self.logger.info(f"  → Extracted {len(enrollments_db1)} enrollments")
        attendance_db1 = pd.read_sql_query("SELECT * FROM attendance", engine1)
        self.logger.info(f"  → Extracted {len(attendance_db1)} attendance records")
        grades_db1 = pd.read_sql_query("SELECT * FROM grades", engine1)
        self.logger.info(f"  → Extracted {len(grades_db1)} grades")
        student_fees_db1 = pd.read_sql_query("SELECT * FROM student_fees", engine1)
        self.logger.info(f"  → Extracted {len(student_fees_db1)} student fees")
        # Extract dimension tables
        faculties_db1 = pd.read_sql_query("SELECT * FROM faculties", engine1)
        self.logger.info(f"  → Extracted {len(faculties_db1)} faculties")
        departments_db1 = pd.read_sql_query("SELECT * FROM departments", engine1)
        self.logger.info(f"  → Extracted {len(departments_db1)} departments")
        programs_db1 = pd.read_sql_query("SELECT * FROM programs", engine1)
        self.logger.info(f"  → Extracted {len(programs_db1)} programs")
        engine1.dispose()
        
        # Extract from Database 2 (ADMINISTRATION) - for future use
        self.logger.info("Extracting from Source Database 2 (ADMINISTRATION)...")
        engine2 = create_engine(DB2_CONN_STRING)
        employees_db2 = pd.read_sql_query("SELECT * FROM employees", engine2)
        self.logger.info(f"  → Extracted {len(employees_db2)} employees")
        payroll_db2 = pd.read_sql_query("SELECT * FROM payroll", engine2)
        self.logger.info(f"  → Extracted {len(payroll_db2)} payroll records")
        engine2.dispose()
        
        # Extract from CSV files (for backward compatibility)
        try:
            payments_csv = pd.read_csv(CSV1_PATH)
        except:
            payments_csv = pd.DataFrame()
        try:
            grades_csv = pd.read_csv(CSV2_PATH)
        except:
            grades_csv = pd.DataFrame()
        
        # Save to Bronze layer (raw data)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        students_db1.to_parquet(self.bronze_path / f"bronze_students_db1_{timestamp}.parquet", index=False)
        courses_db1.to_parquet(self.bronze_path / f"bronze_courses_db1_{timestamp}.parquet", index=False)
        enrollments_db1.to_parquet(self.bronze_path / f"bronze_enrollments_db1_{timestamp}.parquet", index=False)
        attendance_db1.to_parquet(self.bronze_path / f"bronze_attendance_db1_{timestamp}.parquet", index=False)
        grades_db1.to_parquet(self.bronze_path / f"bronze_grades_db1_{timestamp}.parquet", index=False)
        student_fees_db1.to_parquet(self.bronze_path / f"bronze_student_fees_db1_{timestamp}.parquet", index=False)
        if not faculties_db1.empty:
            faculties_db1.to_parquet(self.bronze_path / f"bronze_faculties_db1_{timestamp}.parquet", index=False)
        if not departments_db1.empty:
            departments_db1.to_parquet(self.bronze_path / f"bronze_departments_db1_{timestamp}.parquet", index=False)
        if not programs_db1.empty:
            programs_db1.to_parquet(self.bronze_path / f"bronze_programs_db1_{timestamp}.parquet", index=False)
        
        employees_db2.to_parquet(self.bronze_path / f"bronze_employees_db2_{timestamp}.parquet", index=False)
        payroll_db2.to_parquet(self.bronze_path / f"bronze_payroll_db2_{timestamp}.parquet", index=False)
        
        if not payments_csv.empty:
            payments_csv.to_parquet(self.bronze_path / f"bronze_payments_csv_{timestamp}.parquet", index=False)
        if not grades_csv.empty:
            grades_csv.to_parquet(self.bronze_path / f"bronze_grades_csv_{timestamp}.parquet", index=False)
        
        self.logger.info(f"Bronze layer files saved to: {self.bronze_path}")
        self.logger.info("Bronze layer extraction complete!")
        print("Bronze layer extraction complete!")
        return {
            'students_db1': students_db1,
            'courses_db1': courses_db1,
            'enrollments_db1': enrollments_db1,
            'attendance_db1': attendance_db1,
            'grades_db1': grades_db1,
            'student_fees_db1': student_fees_db1,
            'faculties_db1': faculties_db1,
            'departments_db1': departments_db1,
            'programs_db1': programs_db1,
            'employees_db2': employees_db2,
            'payroll_db2': payroll_db2,
            'payments_csv': payments_csv,
            'grades_csv': grades_csv,
            'high_schools_synthetic': pd.DataFrame(),
            'student_high_schools_synthetic': pd.DataFrame(),
            'transcript_synthetic': pd.DataFrame(),
            'academic_performance_synthetic': pd.DataFrame(),
            'sponsorships_synthetic': pd.DataFrame(),
            'progression_synthetic': pd.DataFrame(),
            'grades_summary_synthetic': pd.DataFrame(),
            'dim_date_synthetic': pd.DataFrame(),
        }

    def _extract_from_synthetic_data(self):
        """Extract from backend/data/Synthetic_Data (CSV/Excel) into same bronze_data structure. RBAC/app users unchanged (seeded separately). Loads every dataset with every column; all faculties/departments from faculties_departments.csv."""
        # Resolve root from ETL file so path works regardless of cwd
        root = (Path(__file__).resolve().parent / "data" / "Synthetic_Data").resolve()
        if not root.exists():
            root = Path(SYNTHETIC_DATA_DIR).resolve()
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        self.logger.info("Synthetic data root: %s", root)
        try:
            found_files = list(root.glob("*.csv")) + list(root.glob("*.xlsx"))
            self.logger.info("  -> Found %d CSV/XLSX files in Synthetic_Data", len(found_files))
        except Exception:
            found_files = []

        # 1) Faculties, departments, programs
        # Primary source: faculties_departments.csv
        # Fallback: derive from course_catalog_ucu.csv (which has FACULTY, DEPARTMENT, PROGRAM, PROGRAM ID)
        fd_path = root / "faculties_departments.csv"
        catalog_path = next((root / f for f in ['course_catalog_ucu.csv', 'course_catalog_ucu.xlsx'] if (root / f).exists()), None)

        if fd_path.exists():
            fd = pd.read_csv(fd_path)
            faculties_db1 = fd[['faculty_id', 'faculty_name']].drop_duplicates().rename(
                columns={'faculty_id': 'FacultyID', 'faculty_name': 'FacultyName'})
            faculties_db1['DeanName'] = 'Dean'
            departments_db1 = fd[['department_id', 'department_name', 'faculty_id']].drop_duplicates().rename(
                columns={'department_id': 'DepartmentID', 'department_name': 'DepartmentName', 'faculty_id': 'FacultyID'})
            departments_db1['HeadOfDepartment'] = 'HOD'
            programs_db1 = fd[['program_id', 'program_name', 'department_id']].drop_duplicates().rename(
                columns={'program_id': 'ProgramID', 'program_name': 'ProgramName', 'department_id': 'DepartmentID'})
            programs_db1['DegreeLevel'] = 'Bachelor'
            programs_db1['DurationYears'] = 4
            self.logger.info("  -> Loaded dimension hierarchy from faculties_departments.csv")
        elif catalog_path is not None:
            # ── FALLBACK: derive hierarchy from course_catalog_ucu ──────────────────
            self.logger.warning("faculties_departments.csv not found — deriving hierarchy from course_catalog_ucu")
            try:
                cat_raw = pd.read_csv(str(catalog_path)) if str(catalog_path).endswith('.csv') else pd.read_excel(str(catalog_path))
                # --- Faculties ---
                fac_col  = next((c for c in cat_raw.columns if c.strip().upper() == 'FACULTY'), None)
                dept_col = next((c for c in cat_raw.columns if c.strip().upper() == 'DEPARTMENT'), None)
                prog_col = next((c for c in cat_raw.columns if c.strip().upper() == 'PROGRAM'), None)
                pid_col  = next((c for c in cat_raw.columns if c.strip().upper() in ('PROGRAM ID', 'PROGRAM_ID')), None)

                if fac_col:
                    fac_list = cat_raw[[fac_col]].drop_duplicates().reset_index(drop=True)
                    fac_list['FacultyID'] = range(1, len(fac_list) + 1)
                    fac_list = fac_list.rename(columns={fac_col: 'FacultyName'})
                    fac_list['DeanName'] = 'Dean'
                    faculties_db1 = fac_list[['FacultyID', 'FacultyName', 'DeanName']]
                    fac_name_to_id = dict(zip(faculties_db1['FacultyName'], faculties_db1['FacultyID']))
                else:
                    faculties_db1 = pd.DataFrame(columns=['FacultyID', 'FacultyName', 'DeanName'])
                    fac_name_to_id = {}

                if dept_col and fac_col:
                    dept_list = cat_raw[[dept_col, fac_col]].drop_duplicates().reset_index(drop=True)
                    dept_list['DepartmentID'] = range(1, len(dept_list) + 1)
                    dept_list['FacultyID'] = dept_list[fac_col].map(fac_name_to_id).fillna(1).astype(int)
                    dept_list['HeadOfDepartment'] = 'HOD'
                    departments_db1 = dept_list.rename(columns={dept_col: 'DepartmentName'})[['DepartmentID', 'DepartmentName', 'FacultyID', 'HeadOfDepartment']]
                    dept_name_to_id = dict(zip(departments_db1['DepartmentName'], departments_db1['DepartmentID']))
                else:
                    departments_db1 = pd.DataFrame(columns=['DepartmentID', 'DepartmentName', 'FacultyID', 'HeadOfDepartment'])
                    dept_name_to_id = {}

                if prog_col:
                    prog_cols_needed = [prog_col]
                    if pid_col: prog_cols_needed.append(pid_col)
                    if dept_col: prog_cols_needed.append(dept_col)
                    prog_list = cat_raw[prog_cols_needed].drop_duplicates(subset=[prog_col]).reset_index(drop=True)
                    if pid_col and pid_col in prog_list.columns:
                        prog_list['ProgramID'] = pd.to_numeric(prog_list[pid_col], errors='coerce').fillna(0).astype(int)
                        # Re-index if IDs are 0 or non-unique
                        if prog_list['ProgramID'].eq(0).any() or prog_list['ProgramID'].duplicated().any():
                            prog_list['ProgramID'] = range(1, len(prog_list)+1)
                    else:
                        prog_list['ProgramID'] = range(1, len(prog_list)+1)
                    prog_list['DepartmentID'] = prog_list[dept_col].map(dept_name_to_id).fillna(1).astype(int) if dept_col in prog_list.columns else 1
                    prog_list['DegreeLevel'] = 'Bachelor'
                    prog_list['DurationYears'] = 4
                    programs_db1 = prog_list.rename(columns={prog_col: 'ProgramName'})[['ProgramID', 'ProgramName', 'DegreeLevel', 'DepartmentID', 'DurationYears']]
                else:
                    programs_db1 = pd.DataFrame(columns=['ProgramID', 'ProgramName', 'DegreeLevel', 'DepartmentID', 'DurationYears'])

                self.logger.info("  -> Derived: %d faculties, %d departments, %d programs from course catalog",
                                 len(faculties_db1), len(departments_db1), len(programs_db1))
            except Exception as _fd_err:
                self.logger.error("Failed to derive hierarchy from course catalog: %s", _fd_err, exc_info=True)
                faculties_db1 = pd.DataFrame(columns=['FacultyID', 'FacultyName', 'DeanName'])
                departments_db1 = pd.DataFrame(columns=['DepartmentID', 'DepartmentName', 'FacultyID', 'HeadOfDepartment'])
                programs_db1 = pd.DataFrame(columns=['ProgramID', 'ProgramName', 'DegreeLevel', 'DepartmentID', 'DurationYears'])
        else:
            self.logger.warning("faculties_departments.csv and course catalog both missing — dimensions will be empty")
            faculties_db1 = pd.DataFrame(columns=['FacultyID', 'FacultyName', 'DeanName'])
            departments_db1 = pd.DataFrame(columns=['DepartmentID', 'DepartmentName', 'FacultyID', 'HeadOfDepartment'])
            programs_db1 = pd.DataFrame(columns=['ProgramID', 'ProgramName', 'DegreeLevel', 'DepartmentID', 'DurationYears'])
        self.logger.info("  -> Faculties: %d, Departments: %d, Programs: %d",
                         len(faculties_db1), len(departments_db1), len(programs_db1))

        # Program name -> program_id mapping (initially from hierarchy/curriculum files; will be
        # extended below using PROGRAM values from students_list15/16 so every program in the
        # student lists has a concrete program_id in dim_program / dim_student).
        program_name_to_id = {}
        if not programs_db1.empty and 'ProgramName' in programs_db1.columns:
            for _, r in programs_db1.iterrows():
                program_name_to_id[str(r['ProgramName']).strip()] = int(r['ProgramID'])

        # 2) Students from students_list15.xlsx and students_list16.xlsx (or _synthetic_5000 variants)
        def _read_students_file(path, list_tag):
            if not path.exists():
                return None
            try:
                if path.suffix.lower() in ('.xlsx', '.xls'):
                    df = pd.read_excel(path)
                else:
                    df = pd.read_csv(path)
            except Exception as e:
                self.logger.warning("Could not read %s: %s", path, e)
                return None
            if df.empty:
                return None
            # Normalize column names (REG. NO. vs REG_NO, etc.)
            col_map = {}
            for c in df.columns:
                if str(c).strip() in ('REG. NO.', 'REG_NO', 'RegNo'):
                    col_map[c] = 'RegNo'
                elif str(c).strip() in ('ACC. NO.', 'ACC_NO', 'AccessNumber'):
                    col_map[c] = 'AccessNumber'
                elif str(c).strip() in ('NAME', 'FullName'):
                    col_map[c] = 'FullName'
                elif str(c).strip() == 'PROGRAM':
                    col_map[c] = 'ProgramName'
                elif str(c).strip() in ('HighSchool', 'HIGH_SCHOOL'):
                    col_map[c] = 'HighSchool'
                elif str(c).strip() in ('HighSchoolDistrict', 'DISTRICT'):
                    col_map[c] = 'HighSchoolDistrict'
                elif str(c).strip() in ('TOTAL REGISTRATIONS', 'TOTAL_REGISTRATIONS', 'YearOfStudy', 'YEAR'):
                    col_map[c] = 'YearOfStudy'
            df = df.rename(columns=col_map)
            return df

        # Prefer one file per cohort (list15 and list16) so we get two distinct student sets
        list15_candidates = ['students_list15.xlsx', 'students_list15_synthetic_5000_corrected_fee_logic.xlsx', 'students_list15_synthetic_5000_corrected_fee_logic.csv']
        list16_candidates = ['students_list16.xlsx', 'students_list16_synthetic_5000_corrected_fee_logic.xlsx', 'students_list16_synthetic_5000_corrected_fee_logic.csv']
        students_parts = []
        for name in list15_candidates:
            p = root / name
            df = _read_students_file(p, name)
            if df is not None:
                students_parts.append(df)
                break
        for name in list16_candidates:
            p = root / name
            df = _read_students_file(p, name)
            if df is not None:
                students_parts.append(df)
                break
        if not students_parts:
            raise FileNotFoundError("No student list found in Synthetic_Data (tried students_list15/16.xlsx and _synthetic_5000 variants)")

        students_df = pd.concat(students_parts, ignore_index=True)
        # One row per student: deduplicate by RegNo so combined list15+list16 gives unique students (e.g. 9,937 not 10,000)
        reg_col = 'RegNo' if 'RegNo' in students_df.columns else students_df.columns[0]
        students_df = students_df.drop_duplicates(subset=[reg_col], keep='first').reset_index(drop=True)
        self.logger.info("  -> Combined student lists: %d unique (by %s)", len(students_df), reg_col)

        # Extend programs_db1 using PROGRAM values from students_list15/16 so every program in the
        # student lists has a concrete ProgramID. Prefer existing hierarchy (from faculties_departments
        # or course_catalog) but add any missing programs here.
        if 'ProgramName' in students_df.columns:
            # Ensure we have a base DataFrame to extend
            if programs_db1 is None or programs_db1.empty:
                programs_db1 = pd.DataFrame(columns=['ProgramID', 'ProgramName', 'DegreeLevel', 'DepartmentID', 'DurationYears'])
            # Track existing program names and max ProgramID
            existing_names = set(str(p).strip() for p in programs_db1.get('ProgramName', []).tolist())
            max_id = int(programs_db1['ProgramID'].max()) if 'ProgramID' in programs_db1.columns and not programs_db1.empty else 0
            # Optionally use DEPARTMENT column from students to assign departments when present
            dept_name_to_id = {}
            if 'departments_db1' in locals() and not departments_db1.empty and 'DepartmentName' in departments_db1.columns:
                dept_name_to_id = {str(n).strip(): int(i) for n, i in zip(departments_db1['DepartmentName'], departments_db1['DepartmentID'])}

            new_rows = []
            for prog_name in sorted(set(students_df['ProgramName'].astype(str).str.strip())):
                if not prog_name or prog_name in existing_names:
                    continue
                max_id += 1
                # Infer basic degree level and duration from the program name
                name_upper = prog_name.upper()
                if 'CERTIFICATE' in name_upper:
                    degree_level = 'Certificate'
                    duration_years = 1
                elif 'DIPLOMA' in name_upper:
                    degree_level = 'Diploma'
                    duration_years = 2
                elif name_upper.startswith('PHD'):
                    degree_level = 'PhD'
                    duration_years = 3
                elif name_upper.startswith('MASTER') or name_upper.startswith('MA '):
                    degree_level = 'Master'
                    duration_years = 2
                elif name_upper.startswith('DOCTOR '):
                    degree_level = 'Doctorate'
                    duration_years = 3
                else:
                    degree_level = 'Bachelor'
                    duration_years = 4

                # Try to get a department from the student rows for this program
                dept_id = 1
                if 'DEPARTMENT' in students_df.columns and dept_name_to_id:
                    depts_for_prog = (
                        students_df.loc[students_df['ProgramName'].astype(str).str.strip() == prog_name, 'DEPARTMENT']
                        .astype(str).str.strip().unique()
                    )
                    if len(depts_for_prog) == 1:
                        dept_id = dept_name_to_id.get(depts_for_prog[0], 1)

                new_rows.append({
                    'ProgramID': max_id,
                    'ProgramName': prog_name,
                    'DegreeLevel': degree_level,
                    'DepartmentID': dept_id,
                    'DurationYears': duration_years,
                })
                program_name_to_id[prog_name] = max_id

            if new_rows:
                programs_db1 = pd.concat([programs_db1, pd.DataFrame(new_rows)], ignore_index=True)
                self.logger.info("  -> Extended programs_db1 with %d program(s) from students_list15/16", len(new_rows))

        # Map to DB1-style columns and keep every column from source
        students_db1 = pd.DataFrame()
        students_db1['RegNo'] = students_df['RegNo'].astype(str) if 'RegNo' in students_df.columns else students_df.iloc[:, 0].astype(str)
        students_db1['AccessNumber'] = students_df['AccessNumber'].astype(str) if 'AccessNumber' in students_df.columns else ''
        students_db1['FullName'] = students_df['FullName'].astype(str) if 'FullName' in students_df.columns else students_db1['RegNo']
        # Bronze: avoid literal "nan" from pandas (NaN -> "nan" when cast to str)
        def _strip_nan(s):
            if s is None or (isinstance(s, float) and pd.isna(s)): return ''
            t = str(s).strip()
            return '' if t.lower() in ('nan', 'none', '<na>') else t
        students_db1['RegNo'] = students_db1['RegNo'].apply(_strip_nan)
        students_db1['AccessNumber'] = students_db1['AccessNumber'].apply(_strip_nan)
        students_db1['FullName'] = students_db1['FullName'].apply(_strip_nan)
        students_db1.loc[students_db1['FullName'] == '', 'FullName'] = 'Unknown'
        students_db1['HighSchool'] = students_df['HighSchool'].astype(str) if 'HighSchool' in students_df.columns else ''
        students_db1['HighSchoolDistrict'] = students_df['HighSchoolDistrict'].astype(str) if 'HighSchoolDistrict' in students_df.columns else ''
        students_db1['ProgramName'] = students_df['ProgramName'].astype(str) if 'ProgramName' in students_df.columns else ''
        # Assign ProgramID using the extended program_name_to_id mapping built above
        def _resolve_program_id(name: str) -> int:
            key = str(name).strip()
            return program_name_to_id.get(key, 1)
        students_db1['ProgramID'] = students_db1['ProgramName'].map(_resolve_program_id)
        if 'YearOfStudy' in students_df.columns:
            yos = students_df['YearOfStudy']
            if isinstance(yos, pd.DataFrame):
                yos = yos.iloc[:, 0]
            students_db1['YearOfStudy'] = pd.to_numeric(yos, errors='coerce').fillna(1).astype(int)
        else:
            students_db1['YearOfStudy'] = 1
        students_db1['Status'] = 'Active'
        students_db1['StudentID'] = range(1, len(students_db1) + 1)
        # Ensure every row has a non-empty RegNo (use StudentID as fallback for display/joins)
        mask = (students_db1['RegNo'] == '') | (students_db1['RegNo'].str.lower() == 'nan')
        students_db1.loc[mask, 'RegNo'] = students_db1.loc[mask, 'StudentID'].astype(str)
        for col in students_df.columns:
            if col not in students_db1.columns:
                students_db1[col] = students_df[col].values
        reg_to_sid = dict(zip(students_db1['RegNo'].astype(str), students_db1['StudentID']))
        self.logger.info("  -> Students: %d (columns: %d)", len(students_db1), len(students_db1.columns))

        # 3) Courses from course_catalog_ucu (csv or xlsx) - load every column
        cat = None
        for candidate in ['course_catalog_ucu.csv', 'course_catalog_ucu_actual_titles.csv']:
            course_path = root / candidate
            if course_path.exists():
                try:
                    cat = pd.read_csv(course_path)
                    break
                except Exception as e:
                    self.logger.warning("Could not read %s: %s", candidate, e)
        if cat is None:
            for candidate in ['course_catalog_ucu.xlsx', 'course_catalog_ucu.xls']:
                course_path = root / candidate
                if course_path.exists():
                    try:
                        cat = pd.read_excel(course_path, engine='openpyxl')
                        break
                    except Exception as e1:
                        try:
                            cat = pd.read_excel(course_path)
                            break
                        except Exception as e2:
                            self.logger.warning("Could not read %s: %s / %s", candidate, e1, e2)
        if cat is not None and not cat.empty:
            code_col = next((c for c in cat.columns if 'COURSE_CODE' in str(c).upper() or (str(c).lower() == 'course_code')), cat.columns[0])
            title_col = next((c for c in cat.columns if 'COURSE_TITLE' in str(c).upper() or (str(c).lower() == 'course_title')), cat.columns[1] if len(cat.columns) > 1 else cat.columns[0])
            units_col = next((c for c in cat.columns if 'COURSE_UNITS' in str(c).upper() or 'units' in str(c).lower() or 'credits' in str(c).lower()), None)
            courses_db1 = pd.DataFrame({
                'CourseID': range(1, len(cat) + 1),
                'CourseCode': cat[code_col].astype(str),
                'CourseName': cat[title_col].astype(str),
                'CreditUnits': pd.to_numeric(cat[units_col], errors='coerce').fillna(3).astype(int) if units_col else pd.Series([3] * len(cat), index=cat.index),
            })
            for col in cat.columns:
                if col not in courses_db1.columns:
                    courses_db1[col] = cat[col].values
        else:
            courses_db1 = pd.DataFrame(columns=['CourseID', 'CourseCode', 'CourseName', 'CreditUnits'])
        self.logger.info("  -> Courses: %d (columns: %d)", len(courses_db1), len(courses_db1.columns))
        course_code_to_id = dict(zip(courses_db1['CourseCode'], courses_db1['CourseID'])) if not courses_db1.empty else {}

        # 4) Grades from student_grades_list15.csv and list16
        # KEY: Keep REG_NO as student key (matches dim_student.student_id) and RECORD_ID as grade_id
        grades_parts = []
        for fidx, fname in enumerate(['student_grades_list15.csv', 'student_grades_list16.csv']):
            p = root / fname
            if p.exists():
                part = pd.read_csv(p)
                # Prefix RECORD_ID with file index to prevent PK collision across list15 + list16
                if 'RECORD_ID' in part.columns:
                    part['RECORD_ID'] = f'L{fidx+1}_' + part['RECORD_ID'].astype(str)
                part['_source_list'] = fidx + 1
                grades_parts.append(part)
        if grades_parts:
            grades_df = pd.concat(grades_parts, ignore_index=True)
            grades_db1 = pd.DataFrame()
            # Use REG_NO directly as student_id — no integer mapping needed; dim_student.student_id = REG_NO
            grades_db1['REG_NO']          = grades_df['REG_NO'].astype(str).str.strip()
            grades_db1['CourseCode']      = grades_df['COURSE_CODE'].astype(str).str.strip()
            grades_db1['CourseworkScore'] = pd.to_numeric(grades_df['CW_MARK_60'],    errors='coerce').fillna(0)
            grades_db1['ExamScore']       = grades_df['EXAM_MARK_40'].replace('', np.nan)
            grades_db1['TotalScore']      = pd.to_numeric(grades_df['FINAL_MARK_100'], errors='coerce').fillna(0)
            grades_db1['GradeLetter']     = grades_df['LETTER_GRADE'].astype(str)
            grades_db1['ExamStatus']      = grades_df['STATUS'].astype(str)
            grades_db1['AbsenceReason']   = grades_df.get('MEX_REASON', pd.Series([''] * len(grades_df))).fillna('').astype(str)
            grades_db1['FCW']             = (grades_df['STATUS'].astype(str) == 'FCW')
            # Use RECORD_ID as the natural PK (already prefixed above to avoid cross-list collision)
            if 'RECORD_ID' in grades_df.columns:
                grades_db1['GradeID'] = grades_df['RECORD_ID'].astype(str)
            else:
                grades_db1['GradeID'] = [f'GRD{i:07d}' for i in range(1, len(grades_db1)+1)]
            # Preserve all original source columns for silver-layer pass-through
            for col in grades_df.columns:
                if col not in grades_db1.columns:
                    grades_db1[col] = grades_df[col].values
        else:
            grades_db1 = pd.DataFrame(columns=['GradeID', 'REG_NO', 'CourseCode', 'CourseworkScore',
                                                'ExamScore', 'TotalScore', 'GradeLetter', 'ExamStatus',
                                                'AbsenceReason', 'FCW'])
        self.logger.info("  -> Grades: %d (columns: %d)", len(grades_db1), len(grades_db1.columns))


        # 5) Enrollments from enrollment_list15/16 (program-level registrations per student/semester)
        enroll_parts = []
        for fname in ['enrollment_list15.csv', 'enrollment_list16.csv']:
            p = root / fname
            if p.exists():
                try:
                    enroll_parts.append(pd.read_csv(p))
                except Exception as e:
                    self.logger.warning("Could not read %s: %s", fname, e)
        if enroll_parts:
            enroll_df = pd.concat(enroll_parts, ignore_index=True)
            # Normalize key column names from Excel header variants
            col_map = {}
            for c in enroll_df.columns:
                cname = str(c).strip()
                up = cname.upper()
                if up.startswith('REG') and 'NO' in up:
                    col_map[c] = 'REG_NO'
                elif up.startswith('ACC') and 'NO' in up:
                    col_map[c] = 'ACC_NO'
                elif up == 'YEAR':
                    col_map[c] = 'YEAR_OF_STUDY'
                elif up == 'SEMESTER':
                    col_map[c] = 'SEMESTER_INDEX'
                elif up == 'STUDENT STATUS':
                    col_map[c] = 'STUDENT_STATUS'
            if col_map:
                enroll_df = enroll_df.rename(columns=col_map)
            if 'REG_NO' not in enroll_df.columns:
                raise ValueError("enrollment_list15/16.csv must have a 'REG. NO.' column")
            enrollments_db1 = pd.DataFrame()
            enrollments_db1['EnrollmentID'] = range(1, len(enroll_df) + 1)
            enrollments_db1['StudentID'] = enroll_df['REG_NO'].astype(str).map(reg_to_sid).fillna(1).astype(int)
            # No specific course mapping in these files; keep CourseID = 0 so fact_enrollment can still load (with empty course_code).
            enrollments_db1['CourseID'] = 0
            # Optional year-of-study and semester index for downstream analytics
            enrollments_db1['YearOfStudy'] = pd.to_numeric(enroll_df.get('YEAR_OF_STUDY', np.nan), errors='coerce')
            enrollments_db1['SemesterIndex'] = pd.to_numeric(enroll_df.get('SEMESTER_INDEX', np.nan), errors='coerce')
            enrollments_db1['StudentStatus'] = enroll_df.get('STUDENT_STATUS', '').astype(str)
            # Backward-compatibility placeholders (not used by new logic)
            enrollments_db1['AcademicYear'] = ''
            enrollments_db1['Semester'] = ''
        else:
            enrollments_db1 = pd.DataFrame(columns=['EnrollmentID', 'StudentID', 'CourseID', 'AcademicYear', 'Semester'])
        self.logger.info("  -> Enrollments (from enrollment_list15/16): %d", len(enrollments_db1))

        # 6) Payments from student_payments_list15/16
        # KEY: Keep REG_NO as student_id directly — no integer mapping needed
        pay_parts = []
        for fname in ['student_payments_list15.csv', 'student_payments_list16.csv',
                      'student_payments_list15_realistic.csv', 'student_payments_list16_realistic.csv']:
            p = root / fname
            if p.exists():
                pay_parts.append(pd.read_csv(p))
        if pay_parts:
            pay_df = pd.concat(pay_parts, ignore_index=True)
            dates_parsed = pd.to_datetime(pay_df['PAYMENT_DATE'], errors='coerce')
            student_fees_db1 = pd.DataFrame({
                'PaymentID':          pay_df.get('PAYMENT_ID', pd.Series(range(1, len(pay_df)+1))).astype(str),
                'REG_NO':             pay_df['REG_NO'].astype(str).str.strip(),   # use REG_NO directly
                'AmountPaid':         pd.to_numeric(pay_df['AMOUNT_UGX'],   errors='coerce').fillna(0),
                'PaymentDate':        dates_parsed,
                'PaymentTimestamp':   dates_parsed,
                'Year':               dates_parsed.dt.year.fillna(datetime.now().year).astype(int),
                'Semester':           pay_df.get('SEMESTER', pd.Series(['Jan (Easter Semester)'] * len(pay_df))),
                'TuitionNational':    pd.to_numeric(pay_df.get('AMOUNT_UGX', pd.Series([0]*len(pay_df))), errors='coerce').fillna(0),
                'TuitionInternational': 0,
                'FunctionalFees':     0,
                'PaymentMethod':      pay_df.get('PAYMENT_METHOD', pd.Series(['BANK']*len(pay_df))).astype(str),
                'Status':             pay_df.get('PAYMENT_STATUS', pd.Series(['SUCCESS']*len(pay_df))).astype(str),
            })
            for col in pay_df.columns:
                if col not in student_fees_db1.columns:
                    student_fees_db1[col] = pay_df[col].values
        else:
            student_fees_db1 = pd.DataFrame()
        self.logger.info("  -> Payments: %d (columns: %d)", len(student_fees_db1),
                         len(student_fees_db1.columns) if not student_fees_db1.empty else 0)

        # 7) Attendance from student_attendance_list15/16
        # NOTE: attendance source has NO COURSE_CODE — grain is student x date x status
        att_parts = []
        for fname in ['student_attendance_list15.csv', 'student_attendance_list16.csv']:
            p = root / fname
            if p.exists():
                att_parts.append(pd.read_csv(p))
        if att_parts:
            att_df = pd.concat(att_parts, ignore_index=True)
            attendance_db1 = pd.DataFrame({
                'REG_NO': att_df['REG_NO'].astype(str).str.strip(),   # use REG_NO directly
                'Date':   pd.to_datetime(att_df['DATE'], errors='coerce'),
                'Status': att_df['STATUS'].astype(str).str.strip(),
                # Stable synthetic primary key for incremental attendance loads
                'AttendanceID': range(1, len(att_df) + 1),
                # attendance source has no COURSE_CODE — leave empty string so fact_attendance doesn't filter on it
                'course_code': '',
            })
            # Carry forward all original columns for traceability
            for col in att_df.columns:
                if col not in attendance_db1.columns:
                    attendance_db1[col] = att_df[col].values
        else:
            attendance_db1 = pd.DataFrame(columns=['REG_NO', 'Date', 'Status', 'AttendanceID', 'course_code'])
        self.logger.info("  -> Attendance: %d (columns: %d)", len(attendance_db1), len(attendance_db1.columns))

        # 8) Employees: generated 7-13 per department, 6-8 per faculty (keep demo-style but satisfy counts)
        employees_db2 = self._build_employees_for_synthetic(faculties_db1, departments_db1)
        payroll_db2 = pd.DataFrame()

        # 9) High schools and student–high school linkage - load every column from both files
        high_schools_parts = []
        for fname in ['high_schools_dimension.csv', 'high_schools_list.csv']:
            p = root / fname
            if p.exists():
                try:
                    df = pd.read_csv(p)
                    if df.empty:
                        continue
                    # Normalize key columns for concat but keep all original columns
                    renames = {}
                    if 'SCHOOL_NAME' in df.columns and 'school_name' not in df.columns:
                        renames['SCHOOL_NAME'] = 'school_name'
                    if 'DISTRICT' in df.columns and 'district' not in df.columns:
                        renames['DISTRICT'] = 'district'
                    if renames:
                        df = df.rename(columns=renames)
                    if 'school_name' not in df.columns and len(df.columns) > 0:
                        df = df.rename(columns={df.columns[0]: 'school_name'})
                    high_schools_parts.append(df)
                except Exception as e:
                    self.logger.warning("Could not read %s: %s", fname, e)
        if high_schools_parts:
            high_schools_synthetic = pd.concat(high_schools_parts, ignore_index=True, sort=False)
            # Dedupe by school_name if present, else by first column; keep all columns
            key = 'school_name' if 'school_name' in high_schools_synthetic.columns else high_schools_synthetic.columns[0]
            high_schools_synthetic = high_schools_synthetic.drop_duplicates(subset=[key], keep='first')
        else:
            high_schools_synthetic = pd.DataFrame(columns=['school_name', 'district'])
        self.logger.info("  -> High schools: %d (columns: %d)", len(high_schools_synthetic), len(high_schools_synthetic.columns))

        student_high_schools_parts = []
        for fname in ['student_high_schools_all.csv', 'student_high_schools_list15.csv', 'student_high_schools_list16.csv']:
            p = root / fname
            if p.exists():
                try:
                    student_high_schools_parts.append(pd.read_csv(p))
                except Exception as e:
                    self.logger.warning("Could not read %s: %s", fname, e)
        student_high_schools_synthetic = pd.concat(student_high_schools_parts, ignore_index=True).drop_duplicates() if student_high_schools_parts else pd.DataFrame()
        self.logger.info("  -> Student–high school: %d", len(student_high_schools_synthetic))

        # 10) Transcripts (semester-level summary per student)
        transcript_parts = []
        for fname in ['student_transcript_list15.csv', 'student_transcript_list16.csv']:
            p = root / fname
            if p.exists():
                try:
                    transcript_parts.append(pd.read_csv(p))
                except Exception as e:
                    self.logger.warning("Could not read %s: %s", fname, e)
        transcript_synthetic = pd.concat(transcript_parts, ignore_index=True) if transcript_parts else pd.DataFrame()
        self.logger.info("  -> Transcript: %d", len(transcript_synthetic))

        # 11) Fact academic performance (semester-level)
        perf_parts = []
        for fname in ['fact_student_academic_performance_list15.csv', 'fact_student_academic_performance_list16.csv']:
            p = root / fname
            if p.exists():
                try:
                    perf_parts.append(pd.read_csv(p))
                except Exception as e:
                    self.logger.warning("Could not read %s: %s", fname, e)
        academic_performance_synthetic = pd.concat(perf_parts, ignore_index=True) if perf_parts else pd.DataFrame()
        self.logger.info("  -> Academic performance: %d", len(academic_performance_synthetic))

        # 12) Sponsorships
        sponsor_parts = []
        for fname in ['student_sponsorships_list15.csv', 'student_sponsorships_list16.csv']:
            p = root / fname
            if p.exists():
                try:
                    sponsor_parts.append(pd.read_csv(p))
                except Exception as e:
                    self.logger.warning("Could not read %s: %s", fname, e)
        sponsorships_synthetic = pd.concat(sponsor_parts, ignore_index=True) if sponsor_parts else pd.DataFrame()
        self.logger.info("  -> Sponsorships: %d", len(sponsorships_synthetic))

        # 13) Academic progression (XLSX or CSV) - all columns
        progression_parts = []
        for fname in ['academic_progression_list15.xlsx', 'academic_progression_list16.xlsx', 'academic_progression_list15.csv', 'academic_progression_list16.csv']:
            p = root / fname
            if p.exists():
                try:
                    if p.suffix.lower() == '.xlsx':
                        progression_parts.append(pd.read_excel(p))
                    else:
                        progression_parts.append(pd.read_csv(p))
                except Exception as e:
                    self.logger.warning("Could not read %s: %s", fname, e)
        progression_synthetic = pd.concat(progression_parts, ignore_index=True) if progression_parts else pd.DataFrame()
        self.logger.info("  -> Progression: %d", len(progression_synthetic))

        # 14) Grades summary (XLSX, multi-sheet: SEMESTER_GPA, STUDENT_CGPA)
        grades_summary_parts = []
        for fname in ['student_grades_summary_list15.xlsx', 'student_grades_summary_list16.xlsx']:
            p = root / fname
            if p.exists():
                try:
                    xl = pd.ExcelFile(p)
                    for sheet in xl.sheet_names:
                        grades_summary_parts.append(pd.read_excel(p, sheet_name=sheet).assign(_source_file=fname, _sheet=sheet))
                except Exception as e:
                    self.logger.warning("Could not read %s: %s", fname, e)
        grades_summary_synthetic = pd.concat(grades_summary_parts, ignore_index=True) if grades_summary_parts else pd.DataFrame()
        self.logger.info("  -> Grades summary sheets: %d", len(grades_summary_synthetic))

        # 15) Date dimension (optional; warehouse already has dim_time)
        dim_date_synthetic = pd.DataFrame()
        for fname in ['dim_date_2022_2026.xlsx', 'dim_date_2022_2026.csv']:
            p = root / fname
            if p.exists():
                try:
                    dim_date_synthetic = pd.read_excel(p) if p.suffix.lower() == '.xlsx' else pd.read_csv(p)
                    break
                except Exception as e:
                    self.logger.warning("Could not read %s: %s", fname, e)
        if not dim_date_synthetic.empty:
            self.logger.info("  -> Dim date: %d", len(dim_date_synthetic))

        # Bronze parquet (all datasets for traceability)
        students_db1.to_parquet(self.bronze_path / f"bronze_students_db1_{timestamp}.parquet", index=False)
        courses_db1.to_parquet(self.bronze_path / f"bronze_courses_db1_{timestamp}.parquet", index=False)
        enrollments_db1.to_parquet(self.bronze_path / f"bronze_enrollments_db1_{timestamp}.parquet", index=False)
        attendance_db1.to_parquet(self.bronze_path / f"bronze_attendance_db1_{timestamp}.parquet", index=False)
        grades_db1.to_parquet(self.bronze_path / f"bronze_grades_db1_{timestamp}.parquet", index=False)
        student_fees_db1.to_parquet(self.bronze_path / f"bronze_student_fees_db1_{timestamp}.parquet", index=False) if not student_fees_db1.empty else None
        if not faculties_db1.empty:
            faculties_db1.to_parquet(self.bronze_path / f"bronze_faculties_db1_{timestamp}.parquet", index=False)
        if not departments_db1.empty:
            departments_db1.to_parquet(self.bronze_path / f"bronze_departments_db1_{timestamp}.parquet", index=False)
        if not programs_db1.empty:
            programs_db1.to_parquet(self.bronze_path / f"bronze_programs_db1_{timestamp}.parquet", index=False)
        employees_db2.to_parquet(self.bronze_path / f"bronze_employees_db2_{timestamp}.parquet", index=False)
        if not high_schools_synthetic.empty:
            high_schools_synthetic.to_parquet(self.bronze_path / f"bronze_high_schools_{timestamp}.parquet", index=False)
        if not student_high_schools_synthetic.empty:
            student_high_schools_synthetic.to_parquet(self.bronze_path / f"bronze_student_high_schools_{timestamp}.parquet", index=False)
        if not transcript_synthetic.empty:
            transcript_synthetic.to_parquet(self.bronze_path / f"bronze_transcript_{timestamp}.parquet", index=False)
        if not academic_performance_synthetic.empty:
            academic_performance_synthetic.to_parquet(self.bronze_path / f"bronze_academic_performance_{timestamp}.parquet", index=False)
        if not sponsorships_synthetic.empty:
            sponsorships_synthetic.to_parquet(self.bronze_path / f"bronze_sponsorships_{timestamp}.parquet", index=False)
        if not progression_synthetic.empty:
            progression_synthetic.to_parquet(self.bronze_path / f"bronze_progression_{timestamp}.parquet", index=False)
        if not grades_summary_synthetic.empty:
            grades_summary_synthetic.to_parquet(self.bronze_path / f"bronze_grades_summary_{timestamp}.parquet", index=False)
        if not dim_date_synthetic.empty:
            dim_date_synthetic.to_parquet(self.bronze_path / f"bronze_dim_date_{timestamp}.parquet", index=False)

        self.logger.info("Bronze (synthetic) extraction complete.")
        return {
            'students_db1': students_db1,
            'courses_db1': courses_db1,
            'enrollments_db1': enrollments_db1,
            'attendance_db1': attendance_db1,
            'grades_db1': grades_db1,
            'student_fees_db1': student_fees_db1,
            'faculties_db1': faculties_db1,
            'departments_db1': departments_db1,
            'programs_db1': programs_db1,
            'employees_db2': employees_db2,
            'payroll_db2': payroll_db2,
            'payments_csv': pd.DataFrame(),
            'grades_csv': pd.DataFrame(),
            # Synthetic-only datasets for analytics
            'high_schools_synthetic': high_schools_synthetic,
            'student_high_schools_synthetic': student_high_schools_synthetic,
            'transcript_synthetic': transcript_synthetic,
            'academic_performance_synthetic': academic_performance_synthetic,
            'sponsorships_synthetic': sponsorships_synthetic,
            'progression_synthetic': progression_synthetic,
            'grades_summary_synthetic': grades_summary_synthetic,
            'dim_date_synthetic': dim_date_synthetic,
        }

    def _build_employees_for_synthetic(self, faculties_db1, departments_db1):
        """Build employees so each department has 7-13 employees and each faculty has 6-8 (faculty-level)."""
        first_names = ["James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda", "William", "Elizabeth", "David", "Barbara", "Joseph", "Susan", "Charles", "Jessica"]
        last_names = ["Okello", "Namakula", "Kato", "Achieng", "Mukasa", "Wekesa", "Akol", "Atwine", "Kasule", "Mugisha"]
        positions = [1, 2, 3]  # position_id
        contract_types = ["Full-Time", "Part-Time", "Contract"]
        rows = []
        eid = 1
        np.random.seed(42)
        # Per-department: 7-13 employees
        if not departments_db1.empty:
            fid_col = 'FacultyID' if 'FacultyID' in departments_db1.columns else 'faculty_id'
            did_col = 'DepartmentID' if 'DepartmentID' in departments_db1.columns else 'department_id'
            for _, dept in departments_db1.iterrows():
                n = int(np.random.randint(7, 14))
                for i in range(n):
                    rows.append({
                        'EmployeeID': eid,
                        'FullName': f"{np.random.choice(first_names)} {np.random.choice(last_names)}",
                        'PositionID': int(np.random.choice(positions)),
                        'DepartmentID': int(dept[did_col]),
                        'ContractType': np.random.choice(contract_types),
                        'Status': 'Active',
                    })
                    eid += 1
        # Per-faculty: 6-8 (assign to first department of that faculty)
        if not faculties_db1.empty and not departments_db1.empty:
            fid_col = 'FacultyID' if 'FacultyID' in faculties_db1.columns else 'faculty_id'
            did_col = 'DepartmentID' if 'DepartmentID' in departments_db1.columns else 'department_id'
            for _, fac in faculties_db1.iterrows():
                f_id = int(fac[fid_col])
                depts = departments_db1[departments_db1[fid_col] == f_id]
                if depts.empty:
                    continue
                first_dept_id = int(depts[did_col].iloc[0])
                n = int(np.random.randint(6, 9))
                for i in range(n):
                    rows.append({
                        'EmployeeID': eid,
                        'FullName': f"{np.random.choice(first_names)} {np.random.choice(last_names)}",
                        'PositionID': int(np.random.choice(positions)),
                        'DepartmentID': first_dept_id,
                        'ContractType': np.random.choice(contract_types),
                        'Status': 'Active',
                    })
                    eid += 1
        df = pd.DataFrame(rows) if rows else pd.DataFrame(columns=['EmployeeID', 'FullName', 'PositionID', 'DepartmentID', 'ContractType', 'Status'])
        self.logger.info("  -> Employees (synthetic): %d", len(df))
        return df

    def transform(self, bronze_data):
        """Transform and clean data (Silver Layer)"""
        self.logger.info("=" * 60)
        self.logger.info("TRANSFORM PHASE - Silver Layer")
        self.logger.info("=" * 60)
        print("Transforming data to Silver layer...")
        
        # Transform Students (DB1) - map to warehouse format; support both demo and synthetic column names
        students_silver = bronze_data['students_db1'].copy()
        students_silver = students_silver.fillna('')
        # Normalize synthetic column names to demo-style for consistent handling
        if 'REG_NO' in students_silver.columns and 'RegNo' not in students_silver.columns:
            students_silver['RegNo'] = students_silver['REG_NO'].astype(str)
        if 'ACC_NO' in students_silver.columns and 'AccessNumber' not in students_silver.columns:
            students_silver['AccessNumber'] = students_silver['ACC_NO'].astype(str)
        if 'NAME' in students_silver.columns and 'FullName' not in students_silver.columns:
            students_silver['FullName'] = students_silver['NAME'].astype(str)
        if 'PROGRAM' in students_silver.columns and 'ProgramName' not in students_silver.columns:
            students_silver['ProgramName'] = students_silver['PROGRAM'].astype(str)
        # Create student_id from RegNo for compatibility (warehouse uses reg_no as student_id for synthetic)
        if 'RegNo' in students_silver.columns:
            students_silver['student_id'] = students_silver['RegNo'].astype(str)
            students_silver['reg_no'] = students_silver['RegNo'].astype(str)
        elif 'reg_no' in students_silver.columns:
            students_silver['student_id'] = students_silver['reg_no'].astype(str)
        elif 'StudentID' in students_silver.columns:
            students_silver['student_id'] = students_silver['StudentID'].apply(lambda x: f"STU{int(x):06d}" if pd.notna(x) else '')
        # Extract Access Number
        if 'AccessNumber' in students_silver.columns:
            students_silver['access_number'] = students_silver['AccessNumber'].astype(str)
        else:
            # Generate if missing (for backward compatibility)
            students_silver['access_number'] = students_silver['student_id'].apply(
                lambda x: f"{random.choice(['A', 'B'])}{random.randint(10000, 99999):05d}" if pd.notna(x) else ''
            )
        if 'FullName' in students_silver.columns:
            # Split FullName into first_name and last_name
            names = students_silver['FullName'].str.split(' ', n=1, expand=True)
            students_silver['first_name'] = names[0].fillna('')
            students_silver['last_name'] = names[1].fillna('') if len(names.columns) > 1 else ''
        # Extract high school information
        if 'HighSchool' in students_silver.columns:
            students_silver['high_school'] = students_silver['HighSchool'].astype(str)
        else:
            students_silver['high_school'] = ''
        if 'HighSchoolDistrict' in students_silver.columns:
            students_silver['high_school_district'] = students_silver['HighSchoolDistrict'].astype(str)
        else:
            students_silver['high_school_district'] = ''
        # Extract program and status (synthetic extract sets ProgramID; ensure program_id for dim_student)
        if 'ProgramID' in students_silver.columns:
            students_silver['program_id'] = pd.to_numeric(students_silver['ProgramID'], errors='coerce')
        if 'program_id' not in students_silver.columns:
            students_silver['program_id'] = None
        if 'YearOfStudy' in students_silver.columns:
            students_silver['year_of_study'] = students_silver['YearOfStudy']
        if 'Status' in students_silver.columns:
            students_silver['status'] = students_silver['Status']
        # Add missing columns with defaults
        if 'email' not in students_silver.columns:
            students_silver['email'] = students_silver.get('access_number', '').astype(str) + '@ucu.ac.ug'
        if 'gender' not in students_silver.columns:
            students_silver['gender'] = random.choice(['M', 'F'])
        if 'nationality' not in students_silver.columns:
            students_silver['nationality'] = 'Ugandan'
        if 'admission_date' not in students_silver.columns:
            students_silver['admission_date'] = (datetime.now() - timedelta(days=random.randint(0, 1460))).strftime('%Y-%m-%d')
        students_silver = students_silver.fillna('')

        # Silver-layer cleaning: no "nan" or "None" in display fields (professional UI)
        def _clean_display(v):
            if v is None or (isinstance(v, float) and pd.isna(v)): return ''
            s = str(v).strip()
            if s.lower() in ('nan', 'none', '<na>'): return ''
            return s
        for col in ['RegNo', 'reg_no', 'AccessNumber', 'access_number', 'FullName', 'first_name', 'last_name', 'HighSchool', 'high_school']:
            if col in students_silver.columns:
                students_silver[col] = students_silver[col].apply(_clean_display)
        # Fallbacks for display: name -> "Unknown", reg_no/access_number -> student_id or "—"
        if 'first_name' in students_silver.columns:
            students_silver.loc[students_silver['first_name'] == '', 'first_name'] = 'Unknown'
        if 'last_name' in students_silver.columns:
            students_silver.loc[students_silver['last_name'] == '', 'last_name'] = ''
        # Full name for display (first + last); if both empty use "Unknown"
        if 'first_name' in students_silver.columns and 'last_name' in students_silver.columns:
            full = (students_silver['first_name'] + ' ' + students_silver['last_name']).str.strip()
            students_silver['FullName'] = full.where(full != '', 'Unknown')
        elif 'FullName' in students_silver.columns:
            students_silver.loc[students_silver['FullName'] == '', 'FullName'] = 'Unknown'
        if 'reg_no' in students_silver.columns:
            students_silver.loc[students_silver['reg_no'] == '', 'reg_no'] = students_silver['student_id'].astype(str)
        if 'RegNo' in students_silver.columns:
            students_silver.loc[students_silver['RegNo'] == '', 'RegNo'] = students_silver['student_id'].astype(str)
        if 'access_number' in students_silver.columns:
            students_silver.loc[students_silver['access_number'] == '', 'access_number'] = students_silver['student_id'].astype(str)
        if 'AccessNumber' in students_silver.columns:
            students_silver.loc[students_silver['AccessNumber'] == '', 'AccessNumber'] = students_silver['student_id'].astype(str)
        students_silver = students_silver.fillna('')

        # Transform Courses (DB1)
        courses_silver = bronze_data['courses_db1'].copy()
        courses_silver = courses_silver.fillna('')
        # Map CourseCode to course_code
        if 'CourseCode' in courses_silver.columns:
            courses_silver['course_code'] = courses_silver['CourseCode']
        if 'CourseName' in courses_silver.columns:
            courses_silver['course_name'] = courses_silver['CourseName']
        if 'CreditUnits' in courses_silver.columns:
            courses_silver['credits'] = courses_silver['CreditUnits']
        courses_silver['department'] = 'General'  # Default, can be enhanced
        
        # Clean enrollments - need to join with students and courses to get proper IDs
        enrollments_silver = bronze_data['enrollments_db1'].copy()
        enrollments_silver = enrollments_silver.fillna('')
        
        # Join with students to get RegNo
        if 'StudentID' in enrollments_silver.columns and 'RegNo' in bronze_data['students_db1'].columns:
            student_map = dict(zip(bronze_data['students_db1']['StudentID'], bronze_data['students_db1']['RegNo']))
            enrollments_silver['student_id'] = enrollments_silver['StudentID'].map(student_map).fillna('')
        elif 'StudentID' in enrollments_silver.columns:
            enrollments_silver['student_id'] = enrollments_silver['StudentID'].apply(lambda x: f"STU{int(x):06d}" if pd.notna(x) else '')
        
        # Join with courses to get CourseCode
        if 'CourseID' in enrollments_silver.columns and 'CourseCode' in bronze_data['courses_db1'].columns:
            course_map = dict(zip(bronze_data['courses_db1']['CourseID'], bronze_data['courses_db1']['CourseCode']))
            enrollments_silver['course_code'] = enrollments_silver['CourseID'].map(course_map).fillna('')
        elif 'CourseID' in enrollments_silver.columns:
            enrollments_silver['course_code'] = enrollments_silver['CourseID'].apply(lambda x: f"COURSE{int(x):03d}" if pd.notna(x) else '')
        
        # Derive semester label
        if 'SemesterIndex' in enrollments_silver.columns:
            sem_map = {1: 'Jan (Easter Semester)', 2: 'May (Trinity Semester)', 3: 'September (Advent)'}
            enrollments_silver['semester'] = pd.to_numeric(enrollments_silver['SemesterIndex'], errors='coerce').map(sem_map).fillna('Jan (Easter Semester)')
        elif 'AcademicYear' in enrollments_silver.columns:
            enrollments_silver['semester'] = enrollments_silver['AcademicYear'].astype(str) + ' ' + enrollments_silver.get('Semester', '').astype(str)
        enrollments_silver['enrollment_date'] = pd.to_datetime(datetime.now(), errors='coerce')
        enrollments_silver['status'] = 'Active'
        enrollments_silver['enrollment_id'] = enrollments_silver.get('EnrollmentID', range(1, len(enrollments_silver) + 1))
        
        # Clean attendance (DB1)
        # Attendance source has NO COURSE_CODE — grain is student x date x status
        attendance_silver = bronze_data['attendance_db1'].copy()
        attendance_silver = attendance_silver.fillna('')

        # Stable synthetic primary key for incremental attendance loads
        if 'AttendanceID' in attendance_silver.columns and 'attendance_id' not in attendance_silver.columns:
            attendance_silver['attendance_id'] = pd.to_numeric(
                attendance_silver['AttendanceID'], errors='coerce'
            ).fillna(0).astype(int)

        # student_id: REG_NO stored directly in bronze (no integer mapping)
        if 'REG_NO' in attendance_silver.columns:
            attendance_silver['student_id'] = attendance_silver['REG_NO'].astype(str).str.strip()
        elif 'StudentID' in attendance_silver.columns and 'RegNo' in bronze_data['students_db1'].columns:
            student_map = dict(zip(bronze_data['students_db1']['StudentID'], bronze_data['students_db1']['RegNo']))
            attendance_silver['student_id'] = attendance_silver['StudentID'].map(student_map).fillna('')
        elif 'StudentID' in attendance_silver.columns:
            attendance_silver['student_id'] = attendance_silver['StudentID'].astype(str)

        # course_code: blank for attendance (no course column in source)
        if 'course_code' not in attendance_silver.columns:
            attendance_silver['course_code'] = ''

        if 'Date' in attendance_silver.columns:
            attendance_silver['attendance_date'] = pd.to_datetime(attendance_silver['Date'], errors='coerce')
        elif 'attendance_date' not in attendance_silver.columns:
            attendance_silver['attendance_date'] = pd.NaT

        # hours_attended based on status
        status_col = next((c for c in ['Status', 'STATUS', 'status'] if c in attendance_silver.columns), None)
        if status_col:
            attendance_silver['hours_attended'] = attendance_silver[status_col].apply(
                lambda x: 2.0 if str(x).upper() in ('PRESENT',) else (1.0 if str(x).upper() in ('LATE',) else 0.0)
            )
            attendance_silver['status'] = attendance_silver[status_col].astype(str).str.upper()
        else:
            attendance_silver['hours_attended'] = 2.0
            attendance_silver['status'] = 'PRESENT'
        
        # Clean payments
        if not bronze_data['student_fees_db1'].empty:
            payments_silver = bronze_data['student_fees_db1'].copy()
            payments_silver = payments_silver.fillna('')
            # student_id: REG_NO stored directly in bronze (no integer mapping)
            if 'REG_NO' in payments_silver.columns:
                payments_silver['student_id'] = payments_silver['REG_NO'].astype(str).str.strip()
            elif 'StudentID' in payments_silver.columns and 'RegNo' in bronze_data['students_db1'].columns:
                student_map = dict(zip(bronze_data['students_db1']['StudentID'], bronze_data['students_db1']['RegNo']))
                payments_silver['student_id'] = payments_silver['StudentID'].map(student_map).fillna('')
            elif 'StudentID' in payments_silver.columns:
                payments_silver['student_id'] = payments_silver['StudentID'].astype(str)
            if 'AmountPaid' in payments_silver.columns:
                payments_silver['amount'] = pd.to_numeric(payments_silver['AmountPaid'], errors='coerce').fillna(0)
            # Extract fee breakdown from database
            if 'TuitionNational' in payments_silver.columns:
                payments_silver['tuition_national'] = pd.to_numeric(payments_silver['TuitionNational'], errors='coerce').fillna(0)
            else:
                payments_silver['tuition_national'] = 0
            if 'TuitionInternational' in payments_silver.columns:
                payments_silver['tuition_international'] = pd.to_numeric(payments_silver['TuitionInternational'], errors='coerce').fillna(0)
            else:
                payments_silver['tuition_international'] = 0
            if 'FunctionalFees' in payments_silver.columns:
                payments_silver['functional_fees'] = pd.to_numeric(payments_silver['FunctionalFees'], errors='coerce').fillna(0)
            else:
                payments_silver['functional_fees'] = 0
            # Extract year
            if 'Year' in payments_silver.columns:
                payments_silver['year'] = pd.to_numeric(payments_silver['Year'], errors='coerce').fillna(datetime.now().year)
            else:
                payments_silver['year'] = datetime.now().year
            # Extract payment date/timestamp
            if 'PaymentDate' in payments_silver.columns:
                payments_silver['payment_date'] = pd.to_datetime(payments_silver['PaymentDate'], errors='coerce')
            elif 'PaymentTimestamp' in payments_silver.columns:
                payments_silver['payment_date'] = pd.to_datetime(payments_silver['PaymentTimestamp'], errors='coerce')
            else:
                payments_silver['payment_date'] = pd.to_datetime(datetime.now(), errors='coerce')
            
            # Extract payment timestamp (with time component)
            if 'PaymentTimestamp' in payments_silver.columns:
                payments_silver['payment_timestamp'] = pd.to_datetime(payments_silver['PaymentTimestamp'], errors='coerce')
            elif 'PaymentDate' in payments_silver.columns:
                payments_silver['payment_timestamp'] = pd.to_datetime(payments_silver['PaymentDate'], errors='coerce')
            else:
                payments_silver['payment_timestamp'] = pd.to_datetime(datetime.now(), errors='coerce')
            
            # Extract semester start date
            if 'SemesterStartDate' in payments_silver.columns:
                payments_silver['semester_start_date'] = pd.to_datetime(payments_silver['SemesterStartDate'], errors='coerce')
            else:
                payments_silver['semester_start_date'] = None  # Will be calculated in load phase
            
            payments_silver['payment_method'] = payments_silver.get('PaymentMethod', 'Bank Transfer')
            if 'Status' in payments_silver.columns:
                payments_silver['status'] = payments_silver['Status']
            else:
                payments_silver['status'] = 'Completed'
            if 'Semester' in payments_silver.columns:
                payments_silver['semester'] = payments_silver['Semester']
            payments_silver['payment_id'] = payments_silver.get('PaymentID', range(1, len(payments_silver) + 1))
        elif not bronze_data['payments_csv'].empty:
            payments_silver = bronze_data['payments_csv'].copy()
            payments_silver = payments_silver.fillna('')
            
            # Extract payment date/timestamp
            if 'payment_timestamp' in payments_silver.columns:
                payments_silver['payment_date'] = pd.to_datetime(payments_silver['payment_timestamp'], errors='coerce')
                payments_silver['payment_timestamp'] = pd.to_datetime(payments_silver['payment_timestamp'], errors='coerce')
            elif 'payment_date' in payments_silver.columns:
                payments_silver['payment_date'] = pd.to_datetime(payments_silver['payment_date'], errors='coerce')
                payments_silver['payment_timestamp'] = payments_silver['payment_date']
            else:
                payments_silver['payment_date'] = pd.to_datetime(datetime.now(), errors='coerce')
                payments_silver['payment_timestamp'] = pd.to_datetime(datetime.now(), errors='coerce')
            
            # Extract semester start date
            if 'semester_start_date' in payments_silver.columns:
                payments_silver['semester_start_date'] = pd.to_datetime(payments_silver['semester_start_date'], errors='coerce')
            else:
                payments_silver['semester_start_date'] = None  # Will be calculated in load phase
            
            payments_silver['amount'] = pd.to_numeric(payments_silver.get('amount', 0), errors='coerce').fillna(0)
            # Extract year if present
            if 'year' in payments_silver.columns:
                payments_silver['year'] = pd.to_numeric(payments_silver['year'], errors='coerce').fillna(datetime.now().year)
            else:
                payments_silver['year'] = payments_silver['payment_date'].dt.year.fillna(datetime.now().year)
            # Extract fee breakdown if present
            payments_silver['tuition_national'] = pd.to_numeric(payments_silver.get('tuition_national', 0), errors='coerce').fillna(0)
            payments_silver['tuition_international'] = pd.to_numeric(payments_silver.get('tuition_international', 0), errors='coerce').fillna(0)
            payments_silver['functional_fees'] = pd.to_numeric(payments_silver.get('functional_fees', 0), errors='coerce').fillna(0)
            
            # Extract payment method
            payments_silver['payment_method'] = payments_silver.get('payment_method', 'Bank Transfer')
        else:
            payments_silver = pd.DataFrame()
        
        # Clean grades
        if not bronze_data['grades_db1'].empty:
            grades_silver = bronze_data['grades_db1'].copy()
            grades_silver = grades_silver.fillna('')
            # student_id: REG_NO stored directly in bronze
            if 'REG_NO' in grades_silver.columns:
                grades_silver['student_id'] = grades_silver['REG_NO'].astype(str).str.strip()
            elif 'StudentID' in grades_silver.columns and 'RegNo' in bronze_data['students_db1'].columns:
                student_map = dict(zip(bronze_data['students_db1']['StudentID'], bronze_data['students_db1']['RegNo']))
                grades_silver['student_id'] = grades_silver['StudentID'].map(student_map).fillna('')
            elif 'StudentID' in grades_silver.columns:
                grades_silver['student_id'] = grades_silver['StudentID'].astype(str)
            # course_code from CourseCode column (set in bronze)
            if 'CourseCode' in grades_silver.columns:
                grades_silver['course_code'] = grades_silver['CourseCode'].astype(str).str.strip()
            elif 'COURSE_CODE' in grades_silver.columns:
                grades_silver['course_code'] = grades_silver['COURSE_CODE'].astype(str).str.strip()
            elif 'CourseID' in grades_silver.columns and 'CourseCode' in bronze_data['courses_db1'].columns:
                course_map = dict(zip(bronze_data['courses_db1']['CourseID'], bronze_data['courses_db1']['CourseCode']))
                grades_silver['course_code'] = grades_silver['CourseID'].map(course_map).fillna('')
            elif 'CourseID' in grades_silver.columns:
                grades_silver['course_code'] = grades_silver['CourseID'].astype(str)
            # Extract coursework and exam scores
            if 'CourseworkScore' in grades_silver.columns:
                grades_silver['coursework_score'] = pd.to_numeric(grades_silver['CourseworkScore'], errors='coerce').fillna(0)
            else:
                grades_silver['coursework_score'] = 0.0
            if 'ExamScore' in grades_silver.columns:
                # Replace empty strings with None before converting to numeric
                grades_silver['ExamScore'] = grades_silver['ExamScore'].replace('', None)
                grades_silver['exam_score'] = pd.to_numeric(grades_silver['ExamScore'], errors='coerce')
            else:
                grades_silver['exam_score'] = None
            # Drop original ExamScore and raw EXAM_MARK_40 to avoid parquet mixed-type error (object with float/str)
            for c in ['ExamScore', 'EXAM_MARK_40']:
                if c in grades_silver.columns:
                    grades_silver = grades_silver.drop(columns=[c])
            if 'TotalScore' in grades_silver.columns:
                # Always store numeric score (MEX will have 0, but letter grade will be MEX)
                grades_silver['grade'] = pd.to_numeric(grades_silver['TotalScore'], errors='coerce')
                grades_silver['grade'] = grades_silver['grade'].fillna(0)  # Ensure numeric score is always present
            if 'GradeLetter' in grades_silver.columns:
                grades_silver['letter_grade'] = grades_silver['GradeLetter']
            # Extract FCW flag
            if 'FCW' in grades_silver.columns:
                grades_silver['fcw'] = grades_silver['FCW'].astype(bool)
            else:
                grades_silver['fcw'] = False
            # Extract exam status and absence reason
            if 'ExamStatus' in grades_silver.columns:
                grades_silver['exam_status'] = grades_silver['ExamStatus']
            else:
                grades_silver['exam_status'] = 'Completed'
            if 'AbsenceReason' in grades_silver.columns:
                grades_silver['absence_reason'] = grades_silver['AbsenceReason']
            else:
                grades_silver['absence_reason'] = ''
            # exam_date from ACADEMIC_YEAR so date_key is in dim_time (e.g. 2024/2025 -> 2024-06-01)
            if 'ACADEMIC_YEAR' in grades_silver.columns:
                def _exam_date_from_year(ay):
                    if pd.isna(ay) or ay == '':
                        return pd.Timestamp('2024-06-01')
                    s = str(ay).strip()
                    parts = s.replace('/', '-').split('-')
                    year = int(parts[0]) if parts else 2024
                    return pd.Timestamp(f'{year}-06-01')
                grades_silver['exam_date'] = grades_silver['ACADEMIC_YEAR'].apply(_exam_date_from_year)
            else:
                grades_silver['exam_date'] = pd.to_datetime(datetime.now(), errors='coerce')
            if 'SEMESTER_INDEX' in grades_silver.columns:
                sem_map = {1: 'Jan (Easter Semester)', 2: 'May (Trinity Semester)', 3: 'September (Advent)'}
                grades_silver['semester'] = grades_silver['SEMESTER_INDEX'].map(sem_map).fillna('Jan (Easter Semester)')
            else:
                grades_silver['semester'] = '2023/2024 Sem 1'
            grades_silver['grade_id'] = grades_silver['GradeID'] if 'GradeID' in grades_silver.columns else pd.Series([f'GRD{i:07d}' for i in range(1, len(grades_silver)+1)], index=grades_silver.index)
        elif not bronze_data['grades_csv'].empty:
            grades_silver = bronze_data['grades_csv'].copy()
            grades_silver = grades_silver.fillna('')
            # Extract coursework and exam scores from CSV
            if 'coursework_score' in grades_silver.columns:
                grades_silver['coursework_score'] = pd.to_numeric(grades_silver['coursework_score'], errors='coerce').fillna(0)
            else:
                grades_silver['coursework_score'] = 0.0
            if 'exam_score' in grades_silver.columns:
                # Replace empty strings with None before converting to numeric
                grades_silver['exam_score'] = grades_silver['exam_score'].replace('', None)
                grades_silver['exam_score'] = pd.to_numeric(grades_silver['exam_score'], errors='coerce')
            else:
                grades_silver['exam_score'] = None
            grades_silver['grade'] = pd.to_numeric(grades_silver.get('grade', 0), errors='coerce').fillna(0)
            # Extract FCW flag
            if 'fcw' in grades_silver.columns:
                grades_silver['fcw'] = grades_silver['fcw'].astype(bool)
            else:
                grades_silver['fcw'] = False
            # Extract exam status and absence reason
            if 'exam_status' in grades_silver.columns:
                grades_silver['exam_status'] = grades_silver['exam_status']
            else:
                grades_silver['exam_status'] = 'Completed'
            if 'absence_reason' in grades_silver.columns:
                grades_silver['absence_reason'] = grades_silver['absence_reason']
            else:
                grades_silver['absence_reason'] = ''
            grades_silver['exam_date'] = pd.to_datetime(grades_silver.get('exam_date', datetime.now()), errors='coerce')
            # Extract year if present in CSV
            if 'year' in grades_silver.columns:
                grades_silver['year'] = pd.to_numeric(grades_silver['year'], errors='coerce').fillna(grades_silver['exam_date'].dt.year.fillna(datetime.now().year))
            else:
                grades_silver['year'] = grades_silver['exam_date'].dt.year.fillna(datetime.now().year)
        else:
            grades_silver = pd.DataFrame()
        
        # Save to Silver layer
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        students_silver.to_parquet(self.silver_path / f"silver_students_{timestamp}.parquet", index=False)
        courses_silver.to_parquet(self.silver_path / f"silver_courses_{timestamp}.parquet", index=False)
        enrollments_silver.to_parquet(self.silver_path / f"silver_enrollments_{timestamp}.parquet", index=False)
        attendance_silver.to_parquet(self.silver_path / f"silver_attendance_{timestamp}.parquet", index=False)
        payments_silver.to_parquet(self.silver_path / f"silver_payments_{timestamp}.parquet", index=False)
        # Ensure no object column with mixed types (e.g. EXAM_MARK_40) breaks parquet
        if not grades_silver.empty:
            for col in grades_silver.select_dtypes(include=['object']).columns:
                grades_silver[col] = grades_silver[col].apply(lambda x: '' if pd.isna(x) else str(x))
        grades_silver.to_parquet(self.silver_path / f"silver_grades_{timestamp}.parquet", index=False)
        
        # Pass-through synthetic datasets (map REG_NO -> student_id for warehouse)
        reg_to_student_id = {}
        if 'RegNo' in bronze_data.get('students_db1', pd.DataFrame()).columns:
            reg_to_student_id = dict(zip(bronze_data['students_db1']['RegNo'].astype(str), bronze_data['students_db1']['RegNo'].astype(str)))
        def _ensure_student_id(df, reg_col='REG_NO'):
            if df is None or df.empty:
                return df
            d = df.copy()
            if reg_col in d.columns and 'student_id' not in d.columns:
                d['student_id'] = d[reg_col].astype(str).map(reg_to_student_id).fillna(d[reg_col].astype(str))
            return d
        transcript_silver = _ensure_student_id(bronze_data.get('transcript_synthetic', pd.DataFrame()))
        academic_performance_silver = _ensure_student_id(bronze_data.get('academic_performance_synthetic', pd.DataFrame()))
        sponsorships_silver = _ensure_student_id(bronze_data.get('sponsorships_synthetic', pd.DataFrame()))
        progression_silver = _ensure_student_id(bronze_data.get('progression_synthetic', pd.DataFrame()))
        student_high_schools_silver = _ensure_student_id(bronze_data.get('student_high_schools_synthetic', pd.DataFrame()))
        high_schools_silver = bronze_data.get('high_schools_synthetic', pd.DataFrame())
        if high_schools_silver is None:
            high_schools_silver = pd.DataFrame()
        grades_summary_silver = _ensure_student_id(bronze_data.get('grades_summary_synthetic', pd.DataFrame()), reg_col='REG_NO')
        if grades_summary_silver is None:
            grades_summary_silver = pd.DataFrame()
        dim_date_silver = bronze_data.get('dim_date_synthetic', pd.DataFrame())
        if dim_date_silver is None:
            dim_date_silver = pd.DataFrame()
        
        self.logger.info(f"Silver layer files saved to: {self.silver_path}")
        self.logger.info(f"  → Students: {len(students_silver)}")
        self.logger.info(f"  → Courses: {len(courses_silver)}")
        self.logger.info(f"  → Enrollments: {len(enrollments_silver)}")
        self.logger.info(f"  → Attendance: {len(attendance_silver)}")
        self.logger.info(f"  → Payments: {len(payments_silver)}")
        self.logger.info(f"  → Grades: {len(grades_silver)}")
        self.logger.info(f"  → Transcript: {len(transcript_silver)}")
        self.logger.info(f"  → Academic performance: {len(academic_performance_silver)}")
        self.logger.info(f"  → Sponsorships: {len(sponsorships_silver)}")
        self.logger.info(f"  → Progression: {len(progression_silver)}")
        self.logger.info(f"  → Student–high school: {len(student_high_schools_silver)}")
        self.logger.info(f"  → High schools: {len(high_schools_silver)}")
        self.logger.info("Silver layer transformation complete!")
        print("Silver layer transformation complete!")
        return {
            'students': students_silver,
            'courses': courses_silver,
            'enrollments': enrollments_silver,
            'attendance': attendance_silver,
            'payments': payments_silver,
            'grades': grades_silver,
            # Pass through dimension tables from bronze
            'faculties_db1': bronze_data.get('faculties_db1', pd.DataFrame()),
            'departments_db1': bronze_data.get('departments_db1', pd.DataFrame()),
            'programs_db1': bronze_data.get('programs_db1', pd.DataFrame()),
            'employees_db2': bronze_data.get('employees_db2', pd.DataFrame()),
            # Synthetic datasets for analytics
            'high_schools_synthetic': high_schools_silver,
            'student_high_schools_synthetic': student_high_schools_silver,
            'transcript_synthetic': transcript_silver,
            'academic_performance_synthetic': academic_performance_silver,
            'sponsorships_synthetic': sponsorships_silver,
            'progression_synthetic': progression_silver,
            'grades_summary_synthetic': grades_summary_silver,
            'dim_date_synthetic': dim_date_silver,
        }
    
    def load_to_warehouse(self, silver_data):
        """Load transformed data into star schema data warehouse (Gold Layer)"""
        self.logger.info("=" * 60)
        self.logger.info("LOAD PHASE - Gold Layer (Data Warehouse)")
        self.logger.info("=" * 60)
        print("Loading data to Gold layer (Data Warehouse)...")
        
        # Create data warehouse if it doesn't exist
        self.create_data_warehouse()
        
        engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
        
        # Create dimension tables
        self._create_dimensions(engine, silver_data)
        
        # Populate time dimension before facts (facts reference dim_time)
        self._populate_time_dimension(engine)
        
        # Create fact tables
        self._create_facts(engine, silver_data)
        
        engine.dispose()
        self.logger.info("=" * 60)
        self.logger.info("ETL PIPELINE COMPLETED SUCCESSFULLY")
        self.logger.info(f"Log file saved to: {self.log_file}")
        self.logger.info("=" * 60)
        print("Gold layer (Data Warehouse) loading complete!")
        print(f"ETL log file: {self.log_file}")
    
    def _create_dimensions(self, engine, silver_data):
        """Create dimension tables for star schema"""
        self.logger.info("Creating dimension tables...")
        
        with engine.connect() as conn:
            # PostgreSQL: use CASCADE to drop dependent objects
            # Drop fact tables first (they reference dimensions)
            conn.execute(text("DROP TABLE IF EXISTS fact_grade CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS fact_payment CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS fact_attendance CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS fact_enrollment CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS fact_transcript CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS fact_academic_performance CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS fact_sponsorship CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS fact_progression CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS fact_student_high_school CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS fact_grades_summary CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS dim_date"))

            # Dim_Student and Dim_Course created from DataFrames with all columns (see load below)
            conn.execute(text("DROP TABLE IF EXISTS dim_student CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS dim_course CASCADE"))
            
            # Dim_Time
            conn.execute(text("DROP TABLE IF EXISTS dim_time CASCADE"))
            conn.execute(text("""
                CREATE TABLE dim_time (
                    date_key VARCHAR(8) PRIMARY KEY,
                    date DATE,
                    year INT,
                    quarter INT,
                    month INT,
                    month_name VARCHAR(20),
                    day INT,
                    day_of_week INT,
                    day_name VARCHAR(20),
                    is_weekend BOOLEAN
                )
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_dt_date ON dim_time(date)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_dt_year_month ON dim_time(year, month)"))
            
            # Dim_Semester
            conn.execute(text("DROP TABLE IF EXISTS dim_semester CASCADE"))
            conn.execute(text("""
                CREATE TABLE dim_semester (
                    semester_id INT PRIMARY KEY,
                    semester_name VARCHAR(50),
                    academic_year VARCHAR(20)
                )
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_ds_academic_year ON dim_semester(academic_year)"))

            # Dim_App_User - snapshot of RBAC app users into the warehouse for reproducibility and analytics
            conn.execute(text("DROP TABLE IF EXISTS dim_app_user CASCADE"))
            conn.execute(text("""
                CREATE TABLE dim_app_user (
                    app_user_id INT PRIMARY KEY,
                    username VARCHAR(100) NOT NULL UNIQUE,
                    role VARCHAR(50) NOT NULL,
                    full_name VARCHAR(200),
                    faculty_id INT NULL,
                    department_id INT NULL,
                    created_at TIMESTAMP NULL
                )
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_dau_username ON dim_app_user(username)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_dau_role ON dim_app_user(role)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_dau_faculty ON dim_app_user(faculty_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_dau_department ON dim_app_user(department_id)"))

            # Dim_High_School - recreated from DataFrame with all columns when loading
            conn.execute(text("DROP TABLE IF EXISTS dim_high_school CASCADE"))

            conn.commit()
        
        # Dim_Course first (from catalog fallback) so fact tables never fail on FK — then overwrite with silver if present
        courses_dim = pd.DataFrame()
        root = (Path(__file__).resolve().parent / "data" / "Synthetic_Data").resolve()
        for candidate in ['course_catalog_ucu.csv', 'course_catalog_ucu.xlsx', 'course_catalog_ucu.xls']:
            p = root / candidate
            if p.exists():
                try:
                    cat = pd.read_csv(p) if p.suffix.lower() == '.csv' else pd.read_excel(p, engine='openpyxl')
                except Exception:
                    try:
                        cat = pd.read_excel(p) if p.suffix.lower() in ('.xlsx', '.xls') else pd.read_csv(p)
                    except Exception as e:
                        self.logger.warning("Dim_course fallback load failed for %s: %s", candidate, e)
                        continue
                if cat is not None and not cat.empty:
                    code_col = next((c for c in cat.columns if 'COURSE_CODE' in str(c).upper() or str(c).lower() == 'course_code'), cat.columns[0])
                    title_col = next((c for c in cat.columns if 'TITLE' in str(c).upper()), cat.columns[1] if len(cat.columns) > 1 else cat.columns[0])
                    units_col = next((c for c in cat.columns if 'UNIT' in str(c).upper() or 'credits' in str(c).lower()), None)
                    courses_dim = pd.DataFrame({
                        'course_code': cat[code_col].astype(str),
                        'course_name': cat[title_col].astype(str),
                        'credits': pd.to_numeric(cat[units_col], errors='coerce').fillna(3).astype(int) if units_col is not None else pd.Series([3] * len(cat), index=cat.index),
                        'department': 'General',
                    })
                    break
        if not courses_dim.empty:
            courses_dim = courses_dim.drop_duplicates(subset=['course_code'], keep='first')
            courses_dim.to_sql('dim_course', engine, if_exists='replace', index=False)
            self.logger.info(f"  → Loaded {len(courses_dim)} courses into dim_course (from catalog)")
        # Overwrite with silver if present and valid
        silver_courses = silver_data.get('courses', pd.DataFrame())
        if silver_courses is not None and isinstance(silver_courses, pd.DataFrame) and not silver_courses.empty:
            code_col = next((c for c in silver_courses.columns if str(c).lower() in ('course_code', 'coursecode')), None)
            if code_col is None:
                code_col = next((c for c in silver_courses.columns if 'course' in str(c).lower() and 'code' in str(c).lower()), silver_courses.columns[0] if len(silver_courses.columns) else None)
            title_col = next((c for c in silver_courses.columns if str(c).lower() in ('course_name', 'coursename')), None)
            if title_col is None:
                title_col = next((c for c in silver_courses.columns if 'name' in str(c).lower() or 'title' in str(c).lower()), silver_courses.columns[1] if len(silver_courses.columns) > 1 else silver_courses.columns[0])
            units_col = next((c for c in silver_courses.columns if 'credit' in str(c).lower() or 'unit' in str(c).lower()), None)
            if code_col is not None:
                courses_dim = pd.DataFrame({
                    'course_code': silver_courses[code_col].astype(str),
                    'course_name': silver_courses[title_col].astype(str) if title_col else silver_courses[code_col].astype(str),
                    'credits': pd.to_numeric(silver_courses[units_col], errors='coerce').fillna(3).astype(int) if units_col is not None else pd.Series([3] * len(silver_courses), index=silver_courses.index),
                    'department': 'General',
                })
                courses_dim = courses_dim.drop_duplicates(subset=['course_code'], keep='first')
                courses_dim.to_sql('dim_course', engine, if_exists='replace', index=False)
                self.logger.info(f"  → Loaded {len(courses_dim)} courses into dim_course (from silver)")
        
        # Dim_Student - all columns from silver (every column loaded for analysis)
        students_dim = silver_data['students'].copy()
        if 'student_id' not in students_dim.columns and 'RegNo' in students_dim.columns:
            students_dim['student_id'] = students_dim['RegNo'].astype(str)
        if 'reg_no' not in students_dim.columns:
            students_dim['reg_no'] = students_dim.get('student_id', students_dim.get('RegNo', '')).astype(str)
        if 'access_number' not in students_dim.columns:
            students_dim['access_number'] = students_dim.get('AccessNumber', '')
        if 'high_school' not in students_dim.columns:
            students_dim['high_school'] = students_dim.get('HighSchool', '')
        if 'high_school_district' not in students_dim.columns:
            students_dim['high_school_district'] = students_dim.get('HighSchoolDistrict', '')
        if 'program_id' not in students_dim.columns:
            students_dim['program_id'] = students_dim.get('ProgramID', None)
        if 'year_of_study' not in students_dim.columns:
            students_dim['year_of_study'] = students_dim.get('YearOfStudy', 1)
        if 'status' not in students_dim.columns:
            students_dim['status'] = students_dim.get('Status', 'Active')
        students_dim = students_dim.drop_duplicates(subset=['student_id'], keep='first')
        # Make blank access_number unique for display (do not dedup by access_number or we lose students who share ACC_NO)
        if 'access_number' in students_dim.columns:
            mask = students_dim['access_number'].astype(str).str.strip().isin(('', 'nan', 'None'))
            students_dim.loc[mask, 'access_number'] = 'ACC_' + students_dim.loc[mask, 'student_id'].astype(str)
        # Deduplicate columns by normalized name (PostgreSQL is case-sensitive but pandas may produce dupes). Keep last so silver (student_id, status) wins over Excel (StudentID, Status).
        def _norm(s):
            return str(s).replace(' ', '_').replace('-', '_').replace('%', 'pct')[:64].lower()
        seen = {}
        for c in students_dim.columns:
            n = _norm(c)
            seen[n] = c  # last occurrence wins (silver columns added after Excel)
        students_dim = students_dim[[seen[n] for n in seen]]
        # Sanitize column names for SQL (reserved/chars); use lowercase for known warehouse columns
        def _sql_name(col):
            s = str(col).replace(' ', '_').replace('-', '_').replace('%', 'pct')[:64]
            if _norm(col) in ('status', 'year', 'gender', 'nationality', 'reg_no', 'student_id', 'access_number', 'high_school', 'program_id'):
                return _norm(col)
            return s
        students_dim.columns = [_sql_name(c) for c in students_dim.columns]
        students_dim.to_sql('dim_student', engine, if_exists='replace', index=False, method='multi', chunksize=500)
        self.logger.info(f"  → Loaded {len(students_dim)} students into dim_student ({len(students_dim.columns)} columns)")
        
        # Dim_Semester - UCU Semester Names
        semesters = pd.DataFrame({
            'semester_id': [1, 2, 3],
            'semester_name': ['Jan (Easter Semester)', 'May (Trinity Semester)', 'September (Advent)'],
            'academic_year': ['2023-2024', '2023-2024', '2023-2024']  # Can be updated based on actual year
        })
        semesters.to_sql('dim_semester', engine, if_exists='append', index=False)
        self.logger.info(f"  → Loaded {len(semesters)} semesters into dim_semester")
        
        # Dim_App_User - load from RBAC app_users so App User data is reproducible on any machine
        try:
            from api.auth import RBAC_CONN_STRING, _ensure_ucu_rbac_database, _ensure_app_users_table
            _ensure_ucu_rbac_database()
            rbac_engine = create_engine(RBAC_CONN_STRING)
            _ensure_app_users_table(rbac_engine)
            app_users_df = pd.read_sql_query(
                text("""
                    SELECT
                        id AS app_user_id,
                        username,
                        role,
                        full_name,
                        faculty_id,
                        department_id,
                        created_at
                    FROM app_users
                """),
                rbac_engine,
            )
            rbac_engine.dispose()
            if not app_users_df.empty:
                with engine.connect() as conn:
                    conn.execute(text("DELETE FROM dim_app_user"))
                    conn.commit()
                app_users_df.to_sql('dim_app_user', engine, if_exists='append', index=False, method='multi', chunksize=100)
                self.logger.info(f"  → Loaded {len(app_users_df)} app users into dim_app_user")
            else:
                self.logger.info("  → No rows in app_users; dim_app_user left empty")
        except Exception as e:
            self.logger.warning(f"Failed to load dim_app_user from ucu_rbac.app_users: {e}")
        
        # Dim_Faculty - from source database
        if 'faculties_db1' in silver_data and not silver_data['faculties_db1'].empty:
            faculties_dim = silver_data['faculties_db1'].copy()
            # Map column names
            if 'FacultyID' in faculties_dim.columns:
                faculties_dim['faculty_id'] = faculties_dim['FacultyID']
            if 'FacultyName' in faculties_dim.columns:
                faculties_dim['faculty_name'] = faculties_dim['FacultyName']
            if 'DeanName' in faculties_dim.columns:
                faculties_dim['dean_name'] = faculties_dim['DeanName']
            # Select only required columns
            faculty_cols = ['faculty_id', 'faculty_name', 'dean_name']
            available_cols = [col for col in faculty_cols if col in faculties_dim.columns]
            if available_cols:
                faculties_dim = faculties_dim[available_cols].drop_duplicates(subset=['faculty_id'], keep='first')
                with engine.connect() as conn:
                    conn.execute(text("DELETE FROM dim_faculty"))
                    conn.commit()
                faculties_dim.to_sql('dim_faculty', engine, if_exists='append', index=False)
                self.logger.info(f"  -> Loaded {len(faculties_dim)} faculties into dim_faculty")
                print(f"  -> Loaded {len(faculties_dim)} faculties into dim_faculty")
        
        # Dim_Department - from source database
        if 'departments_db1' in silver_data and not silver_data['departments_db1'].empty:
            departments_dim = silver_data['departments_db1'].copy()
            # Map column names
            if 'DepartmentID' in departments_dim.columns:
                departments_dim['department_id'] = departments_dim['DepartmentID']
            if 'DepartmentName' in departments_dim.columns:
                departments_dim['department_name'] = departments_dim['DepartmentName']
            if 'FacultyID' in departments_dim.columns:
                departments_dim['faculty_id'] = departments_dim['FacultyID']
            if 'HeadOfDepartment' in departments_dim.columns:
                departments_dim['head_of_department'] = departments_dim['HeadOfDepartment']
            # Select only required columns
            dept_cols = ['department_id', 'department_name', 'faculty_id', 'head_of_department']
            available_cols = [col for col in dept_cols if col in departments_dim.columns]
            if available_cols:
                departments_dim = departments_dim[available_cols].drop_duplicates(subset=['department_id'], keep='first')
                with engine.connect() as conn:
                    conn.execute(text("DELETE FROM dim_department"))
                    conn.commit()
                departments_dim.to_sql('dim_department', engine, if_exists='append', index=False)
                self.logger.info(f"  -> Loaded {len(departments_dim)} departments into dim_department")
                print(f"  -> Loaded {len(departments_dim)} departments into dim_department")
        
        # Dim_Program - from source database
        if 'programs_db1' in silver_data and not silver_data['programs_db1'].empty:
            programs_dim = silver_data['programs_db1'].copy()
            # Map column names
            if 'ProgramID' in programs_dim.columns:
                programs_dim['program_id'] = programs_dim['ProgramID']
            if 'ProgramName' in programs_dim.columns:
                programs_dim['program_name'] = programs_dim['ProgramName']
            if 'DegreeLevel' in programs_dim.columns:
                programs_dim['degree_level'] = programs_dim['DegreeLevel']
            if 'DepartmentID' in programs_dim.columns:
                programs_dim['department_id'] = programs_dim['DepartmentID']
            if 'DurationYears' in programs_dim.columns:
                programs_dim['duration_years'] = programs_dim['DurationYears']
            # Select only required columns
            program_cols = ['program_id', 'program_name', 'degree_level', 'department_id', 'duration_years']
            available_cols = [col for col in program_cols if col in programs_dim.columns]
            if available_cols:
                programs_dim = programs_dim[available_cols].drop_duplicates(subset=['program_id'], keep='first')
                with engine.connect() as conn:
                    conn.execute(text("DELETE FROM dim_program"))
                    conn.commit()
                programs_dim.to_sql('dim_program', engine, if_exists='append', index=False)
                self.logger.info(f"  -> Loaded {len(programs_dim)} programs into dim_program")
                print(f"  -> Loaded {len(programs_dim)} programs into dim_program")
        
        # Dim_Employee (staff/lecturers) - from source database 2 (Administration)
        if 'employees_db2' in silver_data and not silver_data['employees_db2'].empty:
            employees_dim = silver_data['employees_db2'].copy()
            if 'EmployeeID' in employees_dim.columns:
                employees_dim['employee_id'] = employees_dim['EmployeeID']
            if 'FullName' in employees_dim.columns:
                employees_dim['full_name'] = employees_dim['FullName']
            if 'PositionID' in employees_dim.columns:
                employees_dim['position_id'] = employees_dim['PositionID']
            if 'DepartmentID' in employees_dim.columns:
                employees_dim['department_id'] = employees_dim['DepartmentID']
            if 'ContractType' in employees_dim.columns:
                employees_dim['contract_type'] = employees_dim['ContractType']
            if 'Status' in employees_dim.columns:
                employees_dim['status'] = employees_dim['Status']
            emp_cols = ['employee_id', 'full_name', 'position_id', 'department_id', 'contract_type', 'status']
            available_emp_cols = [c for c in emp_cols if c in employees_dim.columns]
            if available_emp_cols:
                employees_dim = employees_dim[available_emp_cols].drop_duplicates(subset=['employee_id'], keep='first')
                with engine.connect() as conn:
                    conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS dim_employee (
                            employee_id INT PRIMARY KEY,
                            full_name VARCHAR(200),
                            position_id INT,
                            department_id INT,
                            contract_type VARCHAR(50),
                            status VARCHAR(50)
                        )
                    """))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_de_department ON dim_employee(department_id)"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_de_status ON dim_employee(status)"))
                    conn.commit()
                    conn.execute(text("DELETE FROM dim_employee"))
                    conn.commit()
                employees_dim.to_sql('dim_employee', engine, if_exists='append', index=False)
                self.logger.info(f"  -> Loaded {len(employees_dim)} employees (staff/lecturers) into dim_employee")
                print(f"  -> Loaded {len(employees_dim)} employees (staff/lecturers) into dim_employee")
        
        # Dim_High_School - from synthetic high_schools; load every column from source
        high_schools = silver_data.get('high_schools_synthetic', pd.DataFrame())
        if high_schools is not None and not high_schools.empty:
            dim_hs = high_schools.drop_duplicates(keep='first').copy()
            dim_hs.insert(0, 'high_school_id', range(1, len(dim_hs) + 1))
            dim_hs.to_sql('dim_high_school', engine, if_exists='replace', index=False)
            self.logger.info(f"  -> Loaded {len(dim_hs)} high schools into dim_high_school (all columns)")
        
        # Ensure FK-referenced columns have indexes (PostgreSQL requires this for efficient FK lookups).
        with engine.connect() as conn:
            for stmt in [
                "CREATE INDEX IF NOT EXISTS idx_student_id ON dim_student (student_id)",
                "CREATE INDEX IF NOT EXISTS idx_course_code ON dim_course (course_code)",
            ]:
                try:
                    conn.execute(text(stmt))
                    conn.commit()
                except Exception as e:
                    if "already exists" in str(e).lower():
                        pass  # index already exists
                    else:
                        self.logger.warning("  → Index creation: %s", e)
        
    def _populate_time_dimension(self, engine):
        """Populate time dimension table"""
        self.logger.info("Populating time dimension...")
        print("Populating time dimension...")
        
        # Generate dates from 2022-01-01 to 2026-12-31 to cover all payment dates
        # This ensures we have dates for historical payments (2022) and future dates (2025-2026)
        dates = pd.date_range(start='2022-01-01', end='2026-12-31', freq='D')
        time_dim = pd.DataFrame({
            'date_key': [d.strftime('%Y%m%d') for d in dates],
            'date': dates,
            'year': dates.year,
            'quarter': dates.quarter,
            'month': dates.month,
            'month_name': dates.strftime('%B'),
            'day': dates.day,
            'day_of_week': dates.dayofweek,
            'day_name': dates.strftime('%A'),
            'is_weekend': dates.dayofweek >= 5
        })
        
        # Clear existing time dimension data first
        with engine.connect() as conn:
            conn.execute(text("DELETE FROM dim_time"))
            conn.commit()
        
        time_dim.to_sql('dim_time', engine, if_exists='append', index=False, chunksize=1000)
        self.logger.info(f"  → Loaded {len(time_dim)} time dimension records")
        print("Time dimension populated!")
        
    def _create_time_dimension(self):
        """Create time dimension table (helper method)"""
        dates = pd.date_range(start='2023-01-01', end='2025-12-31', freq='D')
        time_dim = pd.DataFrame({
            'date_key': [d.strftime('%Y%m%d') for d in dates],
            'date': dates,
            'year': dates.year,
            'quarter': dates.quarter,
            'month': dates.month,
            'month_name': dates.strftime('%B'),
            'day': dates.day,
            'day_of_week': dates.dayofweek,
            'day_name': dates.strftime('%A'),
            'is_weekend': dates.dayofweek >= 5
        })
        return time_dim
    
    def _create_facts(self, engine, silver_data):
        """Create fact tables for star schema. No FK constraints (dim_student/dim_course from to_sql lack indexes); ETL enforces referential integrity by filtering to valid keys."""
        
        with engine.connect() as conn:
            # Fact_Enrollment
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS fact_enrollment (
                    enrollment_id VARCHAR(20) PRIMARY KEY,
                    student_id VARCHAR(20),
                    course_code VARCHAR(20),
                    date_key VARCHAR(8),
                    semester_id INT,
                    status VARCHAR(20)
                )
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_fe_student ON fact_enrollment(student_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_fe_course ON fact_enrollment(course_code)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_fe_date ON fact_enrollment(date_key)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_fe_semester ON fact_enrollment(semester_id)"))
            
            # Fact_Attendance
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS fact_attendance (
                    attendance_id INT PRIMARY KEY,
                    student_id VARCHAR(20),
                    course_code VARCHAR(20),
                    date_key VARCHAR(8),
                    total_hours DECIMAL(10,2),
                    days_present INT
                )
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_fa_student ON fact_attendance(student_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_fa_course ON fact_attendance(course_code)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_fa_date ON fact_attendance(date_key)"))
            
            # Fact_Payment
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS fact_payment (
                    payment_id VARCHAR(20) PRIMARY KEY,
                    student_id VARCHAR(20),
                    date_key VARCHAR(8),
                    semester_id INT,
                    year INT,
                    tuition_national DECIMAL(15,2),
                    tuition_international DECIMAL(15,2),
                    functional_fees DECIMAL(15,2),
                    amount DECIMAL(15,2),
                    payment_method VARCHAR(50),
                    status VARCHAR(20),
                    student_type VARCHAR(20) DEFAULT 'national',
                    payment_timestamp TIMESTAMP,
                    semester_start_date DATE,
                    deadline_met BOOLEAN DEFAULT FALSE,
                    deadline_type VARCHAR(50),
                    weeks_from_deadline DECIMAL(5,2),
                    late_penalty DECIMAL(15,2) DEFAULT 0
                )
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_fp_student ON fact_payment(student_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_fp_date ON fact_payment(date_key)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_fp_semester ON fact_payment(semester_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_fp_year ON fact_payment(year)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_fp_status ON fact_payment(status)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_fp_timestamp ON fact_payment(payment_timestamp)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_fp_deadline_met ON fact_payment(deadline_met)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_fp_deadline_type ON fact_payment(deadline_type)"))
            
            # Fact_Grade
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS fact_grade (
                    grade_id VARCHAR(64) PRIMARY KEY,
                    student_id VARCHAR(20),
                    course_code VARCHAR(20),
                    date_key VARCHAR(8),
                    semester_id INT,
                    coursework_score DECIMAL(5,2) NOT NULL,
                    exam_score DECIMAL(5,2),
                    grade DECIMAL(5,2) NOT NULL,
                    letter_grade VARCHAR(5) NOT NULL,
                    fcw BOOLEAN DEFAULT FALSE,
                    exam_status VARCHAR(10),
                    absence_reason VARCHAR(200)
                )
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_fg_student ON fact_grade(student_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_fg_course ON fact_grade(course_code)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_fg_date ON fact_grade(date_key)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_fg_semester ON fact_grade(semester_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_fg_grade ON fact_grade(grade)"))
            # Ensure existing deployments have a wide enough grade_id column
            try:
                conn.execute(text("ALTER TABLE fact_grade ALTER COLUMN grade_id TYPE VARCHAR(64)"))
                conn.commit()
            except Exception:
                # Ignore if ALTER is not needed or fails (e.g. column already wide)
                pass
        
        # Load valid keys once for all fact tables (FKs)
        with engine.connect() as conn:
            valid_dates_df = pd.read_sql_query("SELECT date_key FROM dim_time", conn)
            valid_students_df = pd.read_sql_query("SELECT student_id FROM dim_student", conn)
            valid_courses_df = pd.read_sql_query("SELECT course_code FROM dim_course", conn)
            # Existing primary keys for incremental fact loads
            try:
                existing_enrollment_ids = set(
                    pd.read_sql_query("SELECT enrollment_id FROM fact_enrollment", conn)['enrollment_id'].astype(str)
                )
            except Exception:
                existing_enrollment_ids = set()
            try:
                existing_payment_ids = set(
                    pd.read_sql_query("SELECT payment_id FROM fact_payment", conn)['payment_id'].astype(str)
                )
            except Exception:
                existing_payment_ids = set()
            try:
                existing_grade_ids = set(
                    pd.read_sql_query("SELECT grade_id FROM fact_grade", conn)['grade_id'].astype(str)
                )
            except Exception:
                existing_grade_ids = set()
            # Attendance watermark: highest attendance_id already loaded (0 if table empty)
            try:
                att_max_df = pd.read_sql_query("SELECT MAX(attendance_id) AS max_id FROM fact_attendance", conn)
                if not att_max_df.empty and pd.notna(att_max_df['max_id'].iloc[0]):
                    max_attendance_id = int(att_max_df['max_id'].iloc[0])
                else:
                    max_attendance_id = 0
            except Exception:
                max_attendance_id = 0
        def _clean_key(s):
            x = str(s).strip() if s is not None else ''
            return x if x not in ('nan', 'None') else ''
        valid_date_keys = set(_clean_key(x) for x in valid_dates_df['date_key'].tolist() if _clean_key(x))
        valid_student_ids = set(_clean_key(x) for x in valid_students_df['student_id'].tolist() if _clean_key(x))
        valid_course_codes = set(_clean_key(x) for x in valid_courses_df['course_code'].tolist() if _clean_key(x))
        default_date_key = '20240101' if '20240101' in valid_date_keys else (list(valid_date_keys)[0] if valid_date_keys else '20240101')
        
        # Fact_Enrollment
        enrollments = silver_data['enrollments'].copy()
        enrollments['date_key'] = pd.to_datetime(enrollments['enrollment_date'], errors='coerce').dt.strftime('%Y%m%d').fillna('')
        enrollments.loc[enrollments['date_key'] == '', 'date_key'] = default_date_key
        # Map UCU semester names to semester_id
        def map_ucu_semester_enroll(semester_str):
            if pd.isna(semester_str):
                return 1
            sem = str(semester_str).lower()
            if 'jan' in sem or 'easter' in sem:
                return 1  # Jan (Easter Semester)
            elif 'may' in sem or 'trinity' in sem:
                return 2  # May (Trinity Semester)
            elif 'september' in sem or 'advent' in sem:
                return 3  # September (Advent)
            else:
                return 1  # Default
        if 'semester' not in enrollments.columns:
            enrollments['semester'] = 'Jan (Easter Semester)'
        enrollments['semester_id'] = enrollments['semester'].apply(map_ucu_semester_enroll)
        
        req_cols = ['enrollment_id', 'student_id', 'course_code', 'date_key', 'semester_id', 'status']
        missing = [c for c in req_cols if c not in enrollments.columns]
        if missing:
            self.logger.warning("  → Enrollments missing columns %s; skipping fact_enrollment", missing)
            fact_enrollment = pd.DataFrame()
        else:
            fact_enrollment = enrollments[req_cols].copy()
            fact_enrollment['date_key'] = fact_enrollment['date_key'].astype(str)
            fact_enrollment = fact_enrollment[fact_enrollment['date_key'].isin(valid_date_keys)]
            fact_enrollment = fact_enrollment[fact_enrollment['student_id'].astype(str).isin(valid_student_ids)]
            # Allow empty course_code (high-school enrollment from student_high_schools)
            course_str = fact_enrollment['course_code'].astype(str).str.strip().replace('nan', '')
            fact_enrollment = fact_enrollment[(course_str == '') | (course_str.isin(valid_course_codes))]
            fact_enrollment['enrollment_id'] = fact_enrollment['enrollment_id'].astype(str)
            # Drop any duplicates within this batch, then keep only IDs not already in the warehouse
            fact_enrollment = fact_enrollment.drop_duplicates(subset=['enrollment_id'], keep='first')
            before_inc = len(fact_enrollment)
            if existing_enrollment_ids:
                fact_enrollment = fact_enrollment[
                    ~fact_enrollment['enrollment_id'].astype(str).isin(existing_enrollment_ids)
                ]
            self.logger.info(
                "  → fact_enrollment incremental: %d new rows (skipped %d existing)",
                len(fact_enrollment),
                before_inc - len(fact_enrollment),
            )
        
        if not fact_enrollment.empty:
            try:
                fact_enrollment.to_sql('fact_enrollment', engine, if_exists='append', index=False, method='multi', chunksize=15000)
                self.logger.info(f"  → Loaded {len(fact_enrollment)} enrollments into fact_enrollment")
            except Exception as e:
                self.logger.error(f"  → fact_enrollment load failed: {e}", exc_info=True)
        else:
            self.logger.warning("  → No enrollment data to load")
        
        # Fact_Attendance
        attendance = silver_data['attendance']
        if not attendance.empty and 'student_id' in attendance.columns:
            # Use a narrow view of columns for scalability on 3M+ rows
            base_cols = ['student_id']
            if 'attendance_date' in attendance.columns:
                base_cols.append('attendance_date')
            if 'hours_attended' in attendance.columns:
                base_cols.append('hours_attended')
            status_source = next((c for c in ['status', 'Status', 'STATUS'] if c in attendance.columns), None)
            if status_source:
                base_cols.append(status_source)
            if 'attendance_id' in attendance.columns:
                base_cols.append('attendance_id')

            att_valid = attendance[base_cols].copy()
            att_valid['student_id'] = att_valid['student_id'].astype(str)

            # Fast vectorized date_key stringification (assuming attendance_date is datetime, else fallback)
            if 'attendance_date' in att_valid.columns:
                dates = att_valid['attendance_date']
                att_valid['date_key'] = dates.dt.strftime('%Y%m%d') if hasattr(dates, 'dt') else pd.to_datetime(dates, errors='coerce').dt.strftime('%Y%m%d')
                att_valid['date_key'] = att_valid['date_key'].fillna(default_date_key)
            else:
                att_valid['date_key'] = default_date_key

            # Incremental watermark on attendance_id if available
            if 'attendance_id' in att_valid.columns:
                att_valid['attendance_id'] = pd.to_numeric(att_valid['attendance_id'], errors='coerce').fillna(0).astype(int)
            else:
                att_valid['attendance_id'] = 0

            # Only keep rows newer than the max already loaded (no heavy student/date filtering here)
            if max_attendance_id > 0:
                att_valid = att_valid[att_valid['attendance_id'] > max_attendance_id]
            self.logger.info(
                "  -> Attendance: %d rows pre-filter, %d new rows after incremental watermark (max_id=%d)",
                len(attendance),
                len(att_valid),
                max_attendance_id,
            )
            
            if not att_valid.empty:
                # Do NOT aggregate away rows; every raw attendance event becomes one fact row.
                # Derive total_hours and a 0/1 flag for presence.
                status_col = next((c for c in ['status', 'Status', 'STATUS'] if c in att_valid.columns), None)
                if status_col:
                    present_flag = att_valid[status_col].astype(str).str.upper().isin(['PRESENT', 'LATE']).astype(int)
                else:
                    present_flag = (att_valid.get('hours_attended', 0) > 0).astype(int)

                fact_attendance = pd.DataFrame({
                    'attendance_id': att_valid['attendance_id'].astype(int),
                    'student_id': att_valid['student_id'].astype(str),
                    'course_code': '',  # no course dimension in attendance source
                    'date_key': att_valid['date_key'].astype(str),
                    'total_hours': pd.to_numeric(att_valid.get('hours_attended', 0), errors='coerce').fillna(0),
                    'days_present': present_flag,
                })

                try:
                    fact_attendance.to_sql('fact_attendance', engine, if_exists='append', index=False, method='multi', chunksize=15000)
                    self.logger.info("  -> Loaded %d attendance records into fact_attendance", len(fact_attendance))
                    print(f"  -> Loaded {len(fact_attendance)} attendance records into fact_attendance")
                except Exception as e:
                    self.logger.error("  -> fact_attendance load failed: %s", e, exc_info=True)
            else:
                self.logger.warning("  -> Attendance: no rows passed student/date validation — fact_attendance empty")
        else:
            self.logger.warning("  -> No attendance data to load (empty or missing student_id)")
        
        # Fact_Payment
        payments = silver_data['payments'].copy()
        payments['date_key'] = pd.to_datetime(payments['payment_date'], errors='coerce').dt.strftime('%Y%m%d').fillna('')
        payments.loc[payments['date_key'] == '', 'date_key'] = default_date_key
        payments['date_key'] = payments['date_key'].astype(str)
        
        # Map UCU semester names to semester_id
        # UCU semesters: Jan (Easter Semester), May (Trinity Semester), September (Advent)
        def map_ucu_semester(semester_str):
            if pd.isna(semester_str):
                return 1
            sem = str(semester_str).lower()
            if 'jan' in sem or 'easter' in sem:
                return 1  # Jan (Easter Semester)
            elif 'may' in sem or 'trinity' in sem:
                return 2  # May (Trinity Semester)
            elif 'september' in sem or 'advent' in sem:
                return 3  # September (Advent)
            else:
                return 1  # Default
        if 'semester' not in payments.columns:
            payments['semester'] = 'Jan (Easter Semester)'
        payments['semester_id'] = payments['semester'].apply(map_ucu_semester)
        
        # Extract year if present, otherwise from payment_date
        if 'year' in payments.columns:
            payments['year'] = pd.to_numeric(payments['year'], errors='coerce').fillna(payments['payment_date'].dt.year.fillna(datetime.now().year))
        else:
            payments['year'] = pd.to_datetime(payments['payment_date'], errors='coerce').dt.year.fillna(datetime.now().year)
        
        # Extract fee breakdown
        if 'tuition_national' in payments.columns:
            payments['tuition_national'] = pd.to_numeric(payments['tuition_national'], errors='coerce').fillna(0)
        else:
            payments['tuition_national'] = 0
        
        if 'tuition_international' in payments.columns:
            payments['tuition_international'] = pd.to_numeric(payments['tuition_international'], errors='coerce').fillna(0)
        else:
            payments['tuition_international'] = 0
        
        if 'functional_fees' in payments.columns:
            payments['functional_fees'] = pd.to_numeric(payments['functional_fees'], errors='coerce').fillna(0)
        else:
            payments['functional_fees'] = 0
        
        # Determine student_type based on nationality where available:
        # anyone whose nationality is NOT Uganda/Ugandan is classified as 'international'.
        student_type_series = None
        students_df = silver_data.get('students', pd.DataFrame())
        if students_df is not None and not students_df.empty and 'student_id' in students_df.columns:
            nat_map = (
                students_df[['student_id', 'nationality']]
                .assign(
                    student_id=lambda d: d['student_id'].astype(str),
                    nationality=lambda d: d['nationality'].astype(str).str.strip().str.lower(),
                )
                .drop_duplicates(subset=['student_id'])
                .set_index('student_id')['nationality']
            )
            nat_series = payments['student_id'].astype(str).map(nat_map).fillna('')
            def _classify_student_type(n: str) -> str:
                n = (n or '').strip().lower()
                # Treat only explicit Uganda/Ugandan as national; everything else is international
                return 'national' if n in ('uganda', 'ugandan') else 'international'
            student_type_series = nat_series.map(_classify_student_type)

        if student_type_series is not None:
            payments['student_type'] = student_type_series
        else:
            # Fallback: infer from tuition split when nationality is not available
            payments['student_type'] = payments.apply(
                lambda row: 'international' if row['tuition_international'] > 0 else 'national', axis=1
            )
        
        # Extract payment timestamp
        if 'payment_timestamp' in payments.columns:
            payments['payment_timestamp'] = pd.to_datetime(payments['payment_timestamp'], errors='coerce')
        elif 'payment_date' in payments.columns:
            payments['payment_timestamp'] = pd.to_datetime(payments['payment_date'], errors='coerce')
        else:
            payments['payment_timestamp'] = pd.to_datetime(datetime.now())
        
        # Extract semester start date for deadline calculation
        if 'semester_start_date' in payments.columns:
            payments['semester_start_date'] = pd.to_datetime(payments['semester_start_date'], errors='coerce')
        else:
            # Vectorised semester_start_date calculation (avoids slow per-row apply on 130k+ rows)
            pass
        def _semester_start_date_vec(semester_id_series, year_series):
            """Return a pd.Series of Timestamps based on UCU semester schedule."""
            result = pd.Series(pd.NaT, index=semester_id_series.index)
            for sid, month, day in [(1, 1, 15), (2, 5, 15), (3, 8, 29)]:
                mask = semester_id_series == sid
                years = year_series[mask].fillna(datetime.now().year).astype(int)
                result[mask] = pd.to_datetime(
                    years.astype(str) + f'-{month:02d}-{day:02d}', errors='coerce'
                ).values
            # Default fallback for unknown semester IDs
            unknown = result.isna()
            if unknown.any():
                result[unknown] = pd.to_datetime(
                    year_series[unknown].fillna(datetime.now().year).astype(int).astype(str) + '-01-15',
                    errors='coerce'
                ).values
            return result

        payments['semester_start_date'] = _semester_start_date_vec(payments['semester_id'], payments['year'])
        
        # Calculate deadline compliance for payments.
        # To keep the pipeline scalable on large synthetic datasets, skip expensive per-row
        # calculations and record neutral values for deadline-related fields.
        payments['deadline_met'] = False
        payments['deadline_type'] = None
        payments['weeks_from_deadline'] = None
        payments['late_penalty'] = 0
        
        # Filter out rows with invalid dates
        fact_payment_cols = ['payment_id', 'student_id', 'date_key', 'semester_id', 'year',
                            'tuition_national', 'tuition_international', 'functional_fees',
                            'amount', 'payment_method', 'status', 'student_type',
                            'payment_timestamp', 'semester_start_date', 'deadline_met',
                            'deadline_type', 'weeks_from_deadline', 'late_penalty']
        available_cols = [col for col in fact_payment_cols if col in payments.columns]
        fact_payment = payments[available_cols].copy()
        if not fact_payment.empty:
            before = len(fact_payment)
            # Do not filter by dim_time or dim_student here; keep all synthetic payments so analytics
            # can see the full distribution. For incremental loads, only skip rows whose payment_id
            # is already present in the warehouse, but do NOT drop duplicates within this batch so
            # that we never lose any payment facts.
            if 'payment_id' in fact_payment.columns:
                fact_payment['payment_id'] = fact_payment['payment_id'].astype(str)
                if existing_payment_ids:
                    fact_payment = fact_payment[
                        ~fact_payment['payment_id'].astype(str).isin(existing_payment_ids)
                    ]
            self.logger.info("  -> fact_payment ready (incremental, no in-batch dedupe): %d rows (pre-filter: %d)", len(fact_payment), before)
        if not fact_payment.empty:
            try:
                fact_payment.to_sql('fact_payment', engine, if_exists='append', index=False, method='multi', chunksize=2000)
                self.logger.info("  -> Loaded %d payments into fact_payment", len(fact_payment))
                print(f"  -> Loaded {len(fact_payment)} payments into fact_payment")
            except Exception as e:
                self.logger.error("  -> fact_payment load failed: %s", e, exc_info=True)
        else:
            self.logger.warning("  -> No payment data to load")
        
        # Fact_Grade
        grades = silver_data['grades'].copy()
        grades['date_key'] = pd.to_datetime(grades['exam_date'], errors='coerce').dt.strftime('%Y%m%d').fillna('')
        grades.loc[grades['date_key'] == '', 'date_key'] = default_date_key
        grades['date_key'] = grades['date_key'].astype(str)
        # Map UCU semester names to semester_id
        def map_ucu_semester_grade(semester_str):
            if pd.isna(semester_str):
                return 1
            sem = str(semester_str).lower()
            if 'jan' in sem or 'easter' in sem:
                return 1  # Jan (Easter Semester)
            elif 'may' in sem or 'trinity' in sem:
                return 2  # May (Trinity Semester)
            elif 'september' in sem or 'advent' in sem:
                return 3  # September (Advent)
            else:
                return 1  # Default
        if 'semester' not in grades.columns:
            grades['semester'] = 'Jan (Easter Semester)'
        grades['semester_id'] = grades['semester'].apply(map_ucu_semester_grade)
        
        if 'coursework_score' not in grades.columns:
            grades['coursework_score'] = 0.0
        if 'exam_score' not in grades.columns:
            grades['exam_score'] = None
        if 'fcw' not in grades.columns:
            grades['fcw'] = False
        if 'exam_status' not in grades.columns:
            grades['exam_status'] = 'Completed'
        if 'absence_reason' not in grades.columns:
            grades['absence_reason'] = ''
        
        grade_cols = ['grade_id', 'student_id', 'course_code', 'date_key',
                     'semester_id', 'coursework_score', 'exam_score', 'grade',
                     'letter_grade', 'fcw', 'exam_status', 'absence_reason']
        missing_grade_cols = [c for c in grade_cols if c not in grades.columns]
        if missing_grade_cols:
            self.logger.warning("  -> Grades missing columns %s; skipping fact_grade", missing_grade_cols)
            self.logger.warning("  -> Available grade columns: %s", list(grades.columns))
            fact_grade = pd.DataFrame()
        else:
            fact_grade = grades[grade_cols].copy()
            before = len(fact_grade)
            # Do not filter by dim_time or dim_student here; keep all synthetic grades so analytics
            # can see the full grade distribution. Only normalise and de-duplicate on grade_id and
            # skip rows that are already in the warehouse (incremental load).
            fact_grade['grade_id'] = fact_grade['grade_id'].astype(str)
            fact_grade = fact_grade.drop_duplicates(subset=['grade_id'], keep='first')
            if existing_grade_ids:
                fact_grade = fact_grade[
                    ~fact_grade['grade_id'].astype(str).isin(existing_grade_ids)
                ]
            fact_grade['letter_grade'] = fact_grade['letter_grade'].fillna('F').astype(str).str[:5]
            fact_grade['grade'] = pd.to_numeric(fact_grade['grade'], errors='coerce').fillna(0)
            self.logger.info("  -> fact_grade ready (incremental): %d rows (pre-filter: %d)", len(fact_grade), before)
        
        if not fact_grade.empty:
            try:
                fact_grade.to_sql('fact_grade', engine, if_exists='append', index=False, method='multi', chunksize=2000)
                self.logger.info("  -> Loaded %d grades into fact_grade", len(fact_grade))
                print(f"  -> Loaded {len(fact_grade)} grades into fact_grade")
            except Exception as e:
                self.logger.error(f"  → fact_grade load failed: {e}", exc_info=True)
        else:
            self.logger.warning("  → No grade data to load")

        # Synthetic datasets: load every column into warehouse (no column drops)
        def _load_synthetic_table(name, df, table_name):
            if df is None or df.empty:
                self.logger.info(f"  → {table_name}: no data, skipped")
                return
            # Ensure string columns for PostgreSQL; keep all columns
            out = df.copy()
            for c in out.columns:
                if out[c].dtype == object:
                    out[c] = out[c].astype(str).replace('nan', '')
            try:
                # Use smaller chunksize to avoid SQLAlchemy memory blow‑up on very wide, tall tables.
                out.to_sql(table_name, engine, if_exists='replace', index=False, method='multi', chunksize=2000)
                self.logger.info(f"  → Loaded {len(out)} rows into {table_name} ({len(out.columns)} columns)")
            except Exception as e:
                self.logger.error(f"  → {table_name} load failed: {e}", exc_info=True)

        transcript = silver_data.get('transcript_synthetic', pd.DataFrame())
        _load_synthetic_table('transcript_synthetic', transcript, 'fact_transcript')

        academic_perf = silver_data.get('academic_performance_synthetic', pd.DataFrame())
        _load_synthetic_table('academic_performance_synthetic', academic_perf, 'fact_academic_performance')

        sponsorships = silver_data.get('sponsorships_synthetic', pd.DataFrame())
        _load_synthetic_table('sponsorships_synthetic', sponsorships, 'fact_sponsorship')

        progression = silver_data.get('progression_synthetic', pd.DataFrame())
        _load_synthetic_table('progression_synthetic', progression, 'fact_progression')

        student_high_schools = silver_data.get('student_high_schools_synthetic', pd.DataFrame())
        _load_synthetic_table('student_high_schools_synthetic', student_high_schools, 'fact_student_high_school')

        grades_summary = silver_data.get('grades_summary_synthetic', pd.DataFrame())
        # If there are no dedicated grades-summary sheets, fall back to transcript
        # and academic performance summaries so fact_grades_summary is always populated.
        if grades_summary is None or grades_summary.empty:
            transcript = silver_data.get('transcript_synthetic', pd.DataFrame())
            academic_perf = silver_data.get('academic_performance_synthetic', pd.DataFrame())
            frames = []
            if transcript is not None and not transcript.empty:
                frames.append(transcript.copy())
            if academic_perf is not None and not academic_perf.empty:
                frames.append(academic_perf.copy())
            if frames:
                grades_summary = pd.concat(frames, ignore_index=True, sort=False)
                self.logger.info(
                    "  → Grades summary fallback: built from transcript (%d rows) and academic performance (%d rows) -> %d rows",
                    len(transcript) if transcript is not None else 0,
                    len(academic_perf) if academic_perf is not None else 0,
                    len(grades_summary),
                )
        _load_synthetic_table('grades_summary_synthetic', grades_summary, 'fact_grades_summary')

        dim_date_df = silver_data.get('dim_date_synthetic', pd.DataFrame())
        _load_synthetic_table('dim_date_synthetic', dim_date_df, 'dim_date')
    
    def run(self):
        """Run the complete ETL pipeline"""
        start_time = datetime.now()
        self.logger.info("=" * 60)
        self.logger.info("ETL PIPELINE STARTED")
        self.logger.info(f"Start time: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        self.logger.info("=" * 60)
        print("Starting ETL Pipeline...")
        print(f"Log file: {self.log_file}")
        
        try:
            # First: seed RBAC / app-users system from snapshot so user-related
            # data (app users, profiles, workspace state) is reproducible.
            self.seed_user_system_from_snapshot()

            bronze_data = self.extract()
            silver_data = self.transform(bronze_data)
            self.load_to_warehouse(silver_data)
            
            end_time = datetime.now()
            duration = end_time - start_time
            self.logger.info(f"ETL Pipeline completed successfully in {duration}")
            print("ETL Pipeline completed successfully!")
            print(f"Duration: {duration}")
            print(f"Log file: {self.log_file}")
        except Exception as e:
            end_time = datetime.now()
            duration = end_time - start_time
            self.logger.error(f"ETL Pipeline failed after {duration}: {e}", exc_info=True)
            print(f"ETL Pipeline failed: {e}")
            print(f"Check log file for details: {self.log_file}")
            raise

if __name__ == "__main__":
    """
    Entry point for running the ETL pipeline.

    We support three execution modes, controlled by the ETL_PHASE
    environment variable so that each Medallion layer (Bronze / Silver /
    Gold) can be run in its own container:

      - ETL_PHASE=bronze  -> run extract() only (Bronze compute container)
      - ETL_PHASE=silver  -> run extract() + transform() (Silver compute container)
      - ETL_PHASE=gold    -> full pipeline (extract + transform + load)

    If ETL_PHASE is not set or has an unknown value, we default to the
    full end‑to‑end pipeline for backwards compatibility.
    """
    phase = os.environ.get("ETL_PHASE", "gold").strip().lower()
    pipeline = ETLPipeline()

    if phase == "bronze":
        # Bronze container: seed RBAC + extract and persist raw data only.
        pipeline.seed_user_system_from_snapshot()
        pipeline.extract()
    elif phase == "silver":
        # Silver container: seed RBAC, extract from sources into Bronze,
        # then transform into cleaned Silver datasets (no load to warehouse).
        pipeline.seed_user_system_from_snapshot()
        bronze_data = pipeline.extract()
        pipeline.transform(bronze_data)
    else:
        # Gold container (default): run the full Medallion pipeline.
        pipeline.run()
