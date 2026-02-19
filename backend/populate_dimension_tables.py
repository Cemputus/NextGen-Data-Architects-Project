"""Script to create and populate dimension tables"""
from sqlalchemy import create_engine, text
from config import DATA_WAREHOUSE_CONN_STRING, DB1_CONN_STRING
import pandas as pd

print("=" * 60)
print("CREATING AND POPULATING DIMENSION TABLES")
print("=" * 60)

# Connect to data warehouse
dw_engine = create_engine(DATA_WAREHOUSE_CONN_STRING)
# Connect to source database
db1_engine = create_engine(DB1_CONN_STRING)

with dw_engine.connect() as conn:
    # Disable foreign key checks
    conn.execute(text("SET FOREIGN_KEY_CHECKS=0"))
    
    # Create dim_faculty
    print("\n1. Creating dim_faculty...")
    conn.execute(text("DROP TABLE IF EXISTS dim_faculty"))
    conn.execute(text("""
        CREATE TABLE dim_faculty (
            faculty_id INT PRIMARY KEY,
            faculty_name VARCHAR(200),
            dean_name VARCHAR(100),
            INDEX idx_faculty_name (faculty_name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """))
    print("   ✓ dim_faculty created")
    
    # Create dim_department
    print("\n2. Creating dim_department...")
    conn.execute(text("DROP TABLE IF EXISTS dim_department"))
    conn.execute(text("""
        CREATE TABLE dim_department (
            department_id INT PRIMARY KEY,
            department_name VARCHAR(200),
            faculty_id INT,
            head_of_department VARCHAR(100),
            FOREIGN KEY (faculty_id) REFERENCES dim_faculty(faculty_id) ON DELETE CASCADE,
            INDEX idx_faculty (faculty_id),
            INDEX idx_dept_name (department_name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """))
    print("   ✓ dim_department created")
    
    # Create dim_program
    print("\n3. Creating dim_program...")
    conn.execute(text("DROP TABLE IF EXISTS dim_program"))
    conn.execute(text("""
        CREATE TABLE dim_program (
            program_id INT PRIMARY KEY,
            program_name VARCHAR(200),
            degree_level VARCHAR(50),
            department_id INT,
            duration_years INT,
            FOREIGN KEY (department_id) REFERENCES dim_department(department_id) ON DELETE CASCADE,
            INDEX idx_department (department_id),
            INDEX idx_program_name (program_name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """))
    print("   ✓ dim_program created")
    
    # Re-enable foreign key checks
    conn.execute(text("SET FOREIGN_KEY_CHECKS=1"))
    conn.commit()

# Extract data from source database
print("\n4. Extracting data from source database...")
try:
    faculties_df = pd.read_sql_query("SELECT * FROM faculties", db1_engine)
    departments_df = pd.read_sql_query("SELECT * FROM departments", db1_engine)
    programs_df = pd.read_sql_query("SELECT * FROM programs", db1_engine)
    print(f"   ✓ Extracted {len(faculties_df)} faculties, {len(departments_df)} departments, {len(programs_df)} programs")
except Exception as e:
    print(f"   ✗ Error extracting data: {e}")
    faculties_df = pd.DataFrame()
    departments_df = pd.DataFrame()
    programs_df = pd.DataFrame()

# Populate dim_faculty
if not faculties_df.empty:
    print("\n5. Populating dim_faculty...")
    faculties_dim = faculties_df.copy()
    if 'FacultyID' in faculties_dim.columns:
        faculties_dim['faculty_id'] = faculties_dim['FacultyID']
    if 'FacultyName' in faculties_dim.columns:
        faculties_dim['faculty_name'] = faculties_dim['FacultyName']
    if 'DeanName' in faculties_dim.columns:
        faculties_dim['dean_name'] = faculties_dim['DeanName']
    
    faculty_cols = ['faculty_id', 'faculty_name', 'dean_name']
    available_cols = [col for col in faculty_cols if col in faculties_dim.columns]
    if available_cols:
        faculties_dim = faculties_dim[available_cols].drop_duplicates(subset=['faculty_id'], keep='first')
        with dw_engine.connect() as conn:
            conn.execute(text("DELETE FROM dim_faculty"))
            conn.commit()
        faculties_dim.to_sql('dim_faculty', dw_engine, if_exists='append', index=False)
        print(f"   ✓ Loaded {len(faculties_dim)} faculties")

# Populate dim_department
if not departments_df.empty:
    print("\n6. Populating dim_department...")
    departments_dim = departments_df.copy()
    if 'DepartmentID' in departments_dim.columns:
        departments_dim['department_id'] = departments_dim['DepartmentID']
    if 'DepartmentName' in departments_dim.columns:
        departments_dim['department_name'] = departments_dim['DepartmentName']
    if 'FacultyID' in departments_dim.columns:
        departments_dim['faculty_id'] = departments_dim['FacultyID']
    if 'HeadOfDepartment' in departments_dim.columns:
        departments_dim['head_of_department'] = departments_dim['HeadOfDepartment']
    
    dept_cols = ['department_id', 'department_name', 'faculty_id', 'head_of_department']
    available_cols = [col for col in dept_cols if col in departments_dim.columns]
    if available_cols:
        departments_dim = departments_dim[available_cols].drop_duplicates(subset=['department_id'], keep='first')
        with dw_engine.connect() as conn:
            conn.execute(text("DELETE FROM dim_department"))
            conn.commit()
        departments_dim.to_sql('dim_department', dw_engine, if_exists='append', index=False)
        print(f"   ✓ Loaded {len(departments_dim)} departments")

# Populate dim_program
if not programs_df.empty:
    print("\n7. Populating dim_program...")
    programs_dim = programs_df.copy()
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
    
    program_cols = ['program_id', 'program_name', 'degree_level', 'department_id', 'duration_years']
    available_cols = [col for col in program_cols if col in programs_dim.columns]
    if available_cols:
        programs_dim = programs_dim[available_cols].drop_duplicates(subset=['program_id'], keep='first')
        with dw_engine.connect() as conn:
            conn.execute(text("DELETE FROM dim_program"))
            conn.commit()
        programs_dim.to_sql('dim_program', dw_engine, if_exists='append', index=False)
        print(f"   ✓ Loaded {len(programs_dim)} programs")

print("\n" + "=" * 60)
print("✓ Dimension tables created and populated successfully!")
print("=" * 60)

# Verify
print("\nVerifying data...")
with dw_engine.connect() as conn:
    result = conn.execute(text('SELECT COUNT(*) FROM dim_faculty'))
    print(f"  dim_faculty: {result.scalar()} records")
    result = conn.execute(text('SELECT COUNT(*) FROM dim_department'))
    print(f"  dim_department: {result.scalar()} records")
    result = conn.execute(text('SELECT COUNT(*) FROM dim_program'))
    print(f"  dim_program: {result.scalar()} records")

dw_engine.dispose()
db1_engine.dispose()


