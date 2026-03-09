import sys, traceback
sys.path.insert(0, r'd:/NextGen-Data-Architects-Project/backend')
try:
    from etl_pipeline import ETLPipeline
    p = ETLPipeline()
    print('Pipeline init OK')
    bronze = p.extract()
    print('EXTRACT OK')
    for k,v in bronze.items():
        if hasattr(v,'__len__'): print(f'  bronze[{k}]: {len(v)} rows')
    
    silver = p.transform(bronze)
    print('TRANSFORM OK')
    
    g   = silver.get('grades')
    a   = silver.get('attendance')
    pay = silver.get('payments')
    
    print(f'  silver grades rows: {len(g) if g is not None else "None"}')
    if g is not None and len(g) > 0:
        print(f'  grade cols: {list(g.columns[:10])}')
        print(f'  grade student_id[0]: {list(g["student_id"].head(3))}')
        print(f'  grade course_code[0]: {list(g["course_code"].head(3))}')
        print(f'  grade grade_id[0]: {list(g["grade_id"].head(3))}')
        print(f'  grade "grade" col present: {"grade" in g.columns}')
        print(f'  grade "letter_grade" col present: {"letter_grade" in g.columns}')
    
    print(f'  silver attendance rows: {len(a) if a is not None else "None"}')
    if a is not None and len(a) > 0:
        print(f'  attendance cols: {list(a.columns[:8])}')
        print(f'  attendance student_id[0]: {list(a["student_id"].head(3))}')
    
    print(f'  silver payments rows: {len(pay) if pay is not None else "None"}')
    if pay is not None and len(pay) > 0:
        print(f'  payment cols: {list(pay.columns[:10])}')
        print(f'  payment student_id[0]: {list(pay["student_id"].head(3))}')
    
    print('VALIDATION COMPLETE - all transforms OK')
except Exception as e:
    traceback.print_exc()
