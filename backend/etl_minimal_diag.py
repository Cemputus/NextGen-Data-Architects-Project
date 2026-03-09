"""
Minimal ETL diagnostic - writes clean results to a results file
"""
import sys, os, traceback
sys.path.insert(0, r'd:\NextGen-Data-Architects-Project\backend')
import pandas as pd

ROOT = r'd:\NextGen-Data-Architects-Project\backend\data\Synthetic_Data'
OUT  = r'd:\etl_diag_results.txt'

lines = []
def p(msg=''):
    lines.append(str(msg))
    print(msg)

p('='*60)
p('ETL DIAGNOSTIC RESULTS')
p('='*60)

# Check every source file needed
files_to_check = [
    ('student_grades_list15.csv',    'csv'),
    ('student_grades_list16.csv',    'csv'),
    ('student_payments_list15.csv',  'csv'),
    ('student_payments_list16.csv',  'csv'),
    ('student_attendance_list15.csv','csv'),
    ('student_attendance_list16.csv','csv'),
    ('students_list15.xlsx',         'xlsx'),
    ('students_list16.xlsx',         'xlsx'),
    ('faculties_departments.csv',    'csv'),
    ('course_catalog_ucu.csv',       'csv'),
    ('student_transcript_list15.csv','csv'),
    ('student_sponsorships_list15.csv','csv'),
]

p('\n--- FILE STATUS ---')
for fname, ftype in files_to_check:
    path = os.path.join(ROOT, fname)
    if not os.path.exists(path):
        p(f'MISSING : {fname}')
    else:
        try:
            df = pd.read_excel(path, nrows=1) if ftype=='xlsx' else pd.read_csv(path, nrows=1)
            p(f'OK ({df.shape[1]} cols): {fname}')
            p(f'   COLS: {list(df.columns)[:10]}')
        except Exception as e:
            p(f'ERROR   : {fname} => {e}')

p('\n--- DATE KEY VALIDATION ---')
try:
    pay = pd.read_csv(f'{ROOT}/student_payments_list15.csv', nrows=200)
    date_col = next((c for c in pay.columns if 'DATE' in c.upper()), None)
    if date_col:
        dates = pd.to_datetime(pay[date_col], errors='coerce')
        valid = dates.notna().sum()
        date_keys = dates.dt.strftime('%Y%m%d').dropna()
        in_range = date_keys.apply(lambda x: '20220101' <= x <= '20261231').sum()
        p(f'Payment date col: {date_col}')
        p(f'  Valid dates: {valid}/200')
        p(f'  In dim_time range (2022-2026): {in_range}/200')
        p(f'  Sample: {date_keys.head(5).tolist()}')
except Exception as e:
    p(f'Payment date check FAILED: {e}')

try:
    att = pd.read_csv(f'{ROOT}/student_attendance_list15.csv', nrows=200)
    date_col = next((c for c in att.columns if 'DATE' in c.upper()), None)
    if date_col:
        dates = pd.to_datetime(att[date_col], errors='coerce')
        valid = dates.notna().sum()
        date_keys = dates.dt.strftime('%Y%m%d').dropna()
        in_range = date_keys.apply(lambda x: '20220101' <= x <= '20261231').sum()
        p(f'Attendance date col: {date_col}')
        p(f'  Valid dates: {valid}/200')
        p(f'  In dim_time range: {in_range}/200')
        p(f'  Sample: {date_keys.head(5).tolist()}')
except Exception as e:
    p(f'Attendance date check FAILED: {e}')

p('\n--- GRADE REG_NO vs STUDENT REG_NO LINKAGE ---')
try:
    g = pd.read_csv(f'{ROOT}/student_grades_list15.csv', nrows=5000)
    s = pd.read_excel(f'{ROOT}/students_list15.xlsx')
    
    g_reg = next((c for c in g.columns if 'REG' in c.upper()), None)
    s_reg = next((c for c in s.columns if 'REG' in c.upper()), None)
    
    p(f'Grades  REG col: {repr(g_reg)} with {g[g_reg].nunique()} unique values (sample={g.shape[0]})')
    p(f'Student REG col: {repr(s_reg)} with {s[s_reg].nunique()} unique values')
    
    if g_reg and s_reg:
        g_keys = set(g[g_reg].astype(str).str.strip())
        s_keys = set(s[s_reg].astype(str).str.strip())
        overlap = g_keys & s_keys
        p(f'  Overlap: {len(overlap)}/{len(g_keys)} grade keys found in students')
        
    p(f'Grades ACADEMIC_YEAR sample: {g["ACADEMIC_YEAR"].value_counts().head(4).to_dict() if "ACADEMIC_YEAR" in g.columns else "COL MISSING"}')
    p(f'Grades SEMESTER_INDEX dist: {g["SEMESTER_INDEX"].value_counts().to_dict() if "SEMESTER_INDEX" in g.columns else "COL MISSING"}')
    p(f'Grades STATUS dist: {g["STATUS"].value_counts().head(5).to_dict() if "STATUS" in g.columns else "COL MISSING"}')
except Exception as e:
    p(f'Grade linkage check FAILED: {e}')
    traceback.print_exc()

p('\n--- ATTENDANCE COLUMN DETAIL ---')
try:
    att = pd.read_csv(f'{ROOT}/student_attendance_list15.csv', nrows=10)
    p(f'All attendance cols: {list(att.columns)}')
    p(f'STATUS values: {att["STATUS"].tolist() if "STATUS" in att.columns else "NO STATUS COL"}')
    p(f'REG_NO sample: {att[next((c for c in att.columns if "REG" in c.upper()), att.columns[0])].head(3).tolist()}')
except Exception as e:
    p(f'Attendance detail FAILED: {e}')

p('\n--- FACULTIES_DEPARTMENTS ---')
try:
    fd_path = f'{ROOT}/faculties_departments.csv'
    if os.path.exists(fd_path):
        fd = pd.read_csv(fd_path)
        p(f'faculties_departments.csv: {fd.shape} rows x cols')
        p(f'Columns: {list(fd.columns)}')
        p(f'Faculty count: {fd["faculty_id"].nunique() if "faculty_id" in fd.columns else "NO faculty_id"}')
    else:
        p('MISSING: faculties_departments.csv')
except Exception as e:
    p(f'Faculties check FAILED: {e}')

with open(OUT, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))
print(f'\nResults written to {OUT}')
