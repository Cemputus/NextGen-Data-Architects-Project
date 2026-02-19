# UCU Data Structure Update

## Summary
Updated the UCU data structure to match the exact official structure with 11 Faculties/Schools, their departments, and programs.

## Changes Made

### 1. Updated `backend/ucu_actual_data.py`
- **Reduced from 12 to 11 Faculties/Schools** (removed "Faculty of Science")
- **New Structure**: `UCU_STRUCTURE` - A list of tuples containing:
  - `(faculty_id, department_name, program_name, duration_years, tuition_nationals, tuition_non_nationals, degree_level)`
- **Exact Department Mapping**: Each program is now mapped to its exact department
- **Helper Functions Added**:
  - `get_programs_by_faculty(faculty_id)` - Get all programs for a faculty
  - `get_departments_by_faculty(faculty_id)` - Get all departments for a faculty
  - `get_programs_by_department(faculty_id, department_name)` - Get programs for a department
  - `get_all_programs()` - Get all programs

### 2. Updated `backend/setup_databases.py`
- **`generate_faculties()`**: Now uses 11 faculties from `UCU_FACULTIES`
- **`generate_departments()`**: Extracts departments directly from `UCU_STRUCTURE` instead of hardcoded list
- **`generate_programs()`**: Maps programs to their exact departments using `UCU_STRUCTURE`

## New Structure (11 Faculties/Schools)

1. **Bishop Tucker School of Divinity and Theology**
   - Department: Divinity and Theology
   - 6 Programs

2. **School of Education**
   - Department: Education & Literature (12 programs)
   - Department: Postgraduate Studies (5 programs)

3. **Faculty of Public Health, Nursing & Midwifery**
   - Department: Public Health, Nursing & Midwifery
   - 6 Programs

4. **School of Journalism, Media and Communication**
   - Department: Journalism, Media & Communication
   - 4 Programs

5. **Faculty of Agricultural Sciences**
   - Department: Agricultural Science
   - 8 Programs

6. **Faculty of Engineering, Design & Technology**
   - Department: Computing (6 programs)
   - Department: Visual Arts (3 programs)
   - Department: Engineering (6 programs)

7. **School of Social Sciences**
   - Department: Social Sciences
   - 15 Programs

8. **School of Dentistry**
   - Department: Dentistry
   - 1 Program

9. **School of Medicine**
   - Department: Medicine
   - 1 Program

10. **School of Business**
    - Department: Business (4 programs)
    - Department: Human Resource (3 programs)
    - Department: Procurement and Logistics Management (3 programs)
    - Department: Tourism & Hospitality (1 program)
    - Department: Accounting (2 programs)

11. **School of Law**
    - Department: Law
    - 5 Programs

## Total Programs: 100+ programs across all faculties

## Next Steps

1. **Regenerate Source Databases**:
   ```bash
   cd backend
   python setup_databases.py
   ```

2. **Run ETL Pipeline**:
   ```bash
   python etl_pipeline.py
   ```

3. **Verify Data**:
   ```bash
   python inspect_data.py
   ```

## Important Notes

- **Removed**: "Faculty of Science" (was #12) - not in official structure
- **All programs** are now mapped to their exact departments
- **Department names** match exactly as provided
- **Program names** match exactly as provided
- **Tuition fees** remain the same from the PDF

## Data Integrity

- Each program belongs to exactly one department
- Each department belongs to exactly one faculty
- No orphaned programs or departments
- All foreign key relationships maintained

