import pandas as pd
ROOT = r'd:/NextGen-Data-Architects-Project/backend/data/Synthetic_Data'

g = pd.read_csv(ROOT+'/student_grades_list15.csv', nrows=5)
with open('d:/col_detail.txt','w') as f:
    f.write('GRADE COLS: ' + str(list(g.columns)) + '\n')
    f.write(g[['RECORD_ID','REG_NO','COURSE_CODE','CW_MARK_60','EXAM_MARK_40','FINAL_MARK_100','LETTER_GRADE','STATUS']].head(3).to_string() + '\n\n')
    p = pd.read_csv(ROOT+'/student_payments_list15.csv', nrows=10)
    f.write('PAY COLS: ' + str(list(p.columns)) + '\n')
    f.write('PAYMENT_ID sample: ' + str(p['PAYMENT_ID'].head(5).tolist()) + '\n')
    f.write('REG_NO in pay: ' + str(p['REG_NO'].head(5).tolist()) + '\n')
    f.write('PAYMENT_DATE: ' + str(p['PAYMENT_DATE'].head(3).tolist()) + '\n')
    f.write('SEMESTER in pay: ' + str(p['SEMESTER'].head(3).tolist()) + '\n')
    # attendance
    a = pd.read_csv(ROOT+'/student_attendance_list15.csv', nrows=5)
    f.write('\nATTENDANCE COLS: ' + str(list(a.columns)) + '\n')
    f.write(a.head(3).to_string() + '\n')
    # students reg_no -> after mapping
    s = pd.read_excel(ROOT+'/students_list15.xlsx', nrows=5)
    f.write('\nSTUDENT COLS: ' + str(list(s.columns)[:15]) + '\n')
    reg_col = next((c for c in s.columns if 'REG' in str(c).upper()), None)
    f.write('REG col: ' + repr(reg_col) + '\n')
    f.write('REG values: ' + str(list(s[reg_col])[:5]) + '\n')
print('done')
