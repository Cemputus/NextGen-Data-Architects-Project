"""
ETL Diagnostic Script — full column inspection + live ETL run with traceback capture
"""
import sys, traceback, os
sys.path.insert(0, r'd:\NextGen-Data-Architects-Project\backend')

import pandas as pd
import numpy as np

ROOT = r'd:\NextGen-Data-Architects-Project\backend\data\Synthetic_Data'

def check_file(fname, ftype='csv', nrows=3):
    p = f'{ROOT}/{fname}'
    if not os.path.exists(p):
        print(f'  [MISSING] {fname}')
        return None
    try:
        df = pd.read_excel(p, nrows=nrows) if ftype == 'xlsx' else pd.read_csv(p, nrows=nrows)
        print(f'  [OK] {fname}  shape={df.shape}')
        print(f'       cols={list(df.columns)}')
        return df
    except Exception as e:
        print(f'  [ERR] {fname}: {e}')
        return None

print('='*80)
print('STEP 1: SOURCE FILE COLUMN AUDIT')
print('='*80)
check_file('students_list15.xlsx', 'xlsx')
check_file('students_list16.xlsx', 'xlsx')
check_file('student_grades_list15.csv')
check_file('student_grades_list16.csv')
check_file('student_payments_list15.csv')
check_file('student_payments_list16.csv')
check_file('student_attendance_list15.csv')
check_file('student_attendance_list16.csv')
check_file('faculties_departments.csv')
check_file('course_catalog_ucu.csv')
check_file('student_transcript_list15.csv')
check_file('student_sponsorships_list15.csv')
check_file('academic_progression_list15.xlsx', 'xlsx')

print('\n' + '='*80)
print('STEP 2: FULL ETL RUN WITH TRACEBACK')
print('='*80)

try:
    from etl_pipeline import ETLPipeline
    pipeline = ETLPipeline()
    
    print('\n-- EXTRACT --')
    bronze = pipeline.extract()
    for k, v in bronze.items():
        if isinstance(v, pd.DataFrame):
            print(f'  bronze[{k}]: {len(v)} rows, {v.shape[1]} cols')
        else:
            print(f'  bronze[{k}]: {type(v)}')
    
    print('\n-- TRANSFORM --')
    silver = pipeline.transform(bronze)
    for k, v in silver.items():
        if isinstance(v, pd.DataFrame):
            print(f'  silver[{k}]: {len(v)} rows, {v.shape[1]} cols')
        else:
            print(f'  silver[{k}]: {type(v)}')

    print('\n-- LOAD --')
    pipeline.load_to_warehouse(silver)
    print('LOAD COMPLETE')
    
except Exception as e:
    print(f'\n[FATAL ERROR]: {e}')
    traceback.print_exc()
