"""
ETL Quick Diagnostic - column checks only, no full load
"""
import sys, os
sys.path.insert(0, r'd:\NextGen-Data-Architects-Project\backend')
os.environ['ETL_DIAG_ONLY'] = '1'

import pandas as pd
import numpy as np

ROOT = r'd:\NextGen-Data-Architects-Project\backend\data\Synthetic_Data'

print('='*70)
print('COLUMN AUDIT')
print('='*70)

def audit(fname, ftype='csv'):
    p = f'{ROOT}/{fname}'
    if not os.path.exists(p):
        print(f'  MISSING: {fname}')
        return None
    try:
        df = pd.read_excel(p, nrows=5) if ftype=='xlsx' else pd.read_csv(p, nrows=5)
        print(f'  OK  {fname} ({df.shape[1]} cols, sample size={df.shape[0]})')
        for c in df.columns:
            print(f'       | {repr(c)} = {df[c].iloc[0] if len(df)>0 else "N/A"}')
        return df
    except Exception as e:
        print(f'  ERR {fname}: {e}')
        return None

print('\n--- GRADES ---')
g15 = audit('student_grades_list15.csv')
print('\n--- PAYMENTS ---')
p15 = audit('student_payments_list15.csv')
print('\n--- ATTENDANCE ---')
a15 = audit('student_attendance_list15.csv')
print('\n--- STUDENTS ---')
s15 = audit('students_list15.xlsx', 'xlsx')
print('\n--- FACULTIES ---')
fd = audit('faculties_departments.csv')

# Now check the critical foreign key linkage
print('\n' + '='*70)
print('FK LINKAGE CHECK')
print('='*70)

# Load full grades
try:
    g = pd.concat([pd.read_csv(f'{ROOT}/student_grades_list15.csv'), pd.read_csv(f'{ROOT}/student_grades_list16.csv')], ignore_index=True)
    s = pd.concat([pd.read_excel(f'{ROOT}/students_list15.xlsx'), pd.read_excel(f'{ROOT}/students_list16.xlsx')], ignore_index=True)
    
    # Normalize student reg_no key
    student_reg_col = next((c for c in s.columns if 'REG' in str(c).upper()), None)
    grade_reg_col   = next((c for c in g.columns if 'REG' in str(c).upper()), None)
    
    print(f'  Students reg col: {repr(student_reg_col)} ({len(s)} rows)')
    print(f'  Grades   reg col: {repr(grade_reg_col)} ({len(g)} rows)')
    
    if student_reg_col and grade_reg_col:
        s_keys = set(s[student_reg_col].astype(str).str.strip())
        g_keys = set(g[grade_reg_col].astype(str).str.strip())
        matched = s_keys & g_keys
        print(f'  Matching student keys in grades: {len(matched)} / {len(g_keys)} grade reg_nos exist in students')
        
    # Check date columns
    if 'PAYMENT_DATE' in [c for c in pd.read_csv(f'{ROOT}/student_payments_list15.csv', nrows=1).columns]:
        pay = pd.read_csv(f'{ROOT}/student_payments_list15.csv', nrows=100)
        dates = pd.to_datetime(pay['PAYMENT_DATE'], errors='coerce')
        date_keys = dates.dt.strftime('%Y%m%d').dropna()
        print(f'  Payment date sample: {date_keys.head(3).tolist()} (valid={dates.notna().sum()}/100)')
        
    # Check ACADEMIC_YEAR col in grades for date_key derivation
    if 'ACADEMIC_YEAR' in g.columns:
        print(f'  Grade ACADEMIC_YEAR sample: {g["ACADEMIC_YEAR"].head(5).tolist()}')
    if 'SEMESTER_INDEX' in g.columns:
        print(f'  Grade SEMESTER_INDEX sample: {g["SEMESTER_INDEX"].value_counts().head().to_dict()}')
        
except Exception as e:
    import traceback
    traceback.print_exc()
