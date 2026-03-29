-- Demo / seed data for Tuition payment trends (fact_payment + dimensions).
-- Safe to run multiple times (uses ON CONFLICT / high numeric IDs).
-- Usage: psql -h HOST -U USER -d ucu_datawarehouse -f backend/sql/seed_tuition_trends_demo.sql
--    or: python backend/scripts/seed_tuition_trends_demo.py

BEGIN;

-- Calendar rows 2020–2025 (append; does not TRUNCATE dim_time).
INSERT INTO dim_time (
    date_key,
    date,
    year,
    quarter,
    month,
    month_name,
    day,
    day_of_week,
    day_name,
    is_weekend
)
SELECT
    TO_CHAR(d, 'YYYYMMDD') AS date_key,
    d::date AS date,
    EXTRACT(YEAR FROM d)::INT AS year,
    EXTRACT(QUARTER FROM d)::INT AS quarter,
    EXTRACT(MONTH FROM d)::INT AS month,
    TRIM(TO_CHAR(d, 'Month')) AS month_name,
    EXTRACT(DAY FROM d)::INT AS day,
    EXTRACT(DOW FROM d)::INT AS day_of_week,
    TRIM(TO_CHAR(d, 'Day')) AS day_name,
    CASE WHEN EXTRACT(DOW FROM d) IN (0, 6) THEN TRUE ELSE FALSE END AS is_weekend
FROM generate_series('2020-01-01'::DATE, '2025-12-31'::DATE, '1 day'::INTERVAL) AS d
ON CONFLICT (date_key) DO NOTHING;

INSERT INTO dim_faculty (faculty_id, faculty_name, dean_name) VALUES
(99001, 'Demo Faculty Alpha (Tuition Seed)', 'Seed Dean'),
(99002, 'Demo Faculty Beta (Tuition Seed)', 'Seed Dean 2')
ON CONFLICT (faculty_id) DO UPDATE SET
    faculty_name = EXCLUDED.faculty_name,
    dean_name = EXCLUDED.dean_name;

INSERT INTO dim_department (department_id, department_name, faculty_id, head_of_department) VALUES
(99001, 'Demo Dept Alpha', 99001, 'Seed HOD'),
(99002, 'Demo Dept Beta', 99002, 'Seed HOD 2')
ON CONFLICT (department_id) DO UPDATE SET
    department_name = EXCLUDED.department_name,
    faculty_id = EXCLUDED.faculty_id;

INSERT INTO dim_program (program_id, program_name, degree_level, department_id, duration_years) VALUES
(99001, 'Demo BSc CS', 'Bachelors', 99001, 4),
(99002, 'Demo BA Economics', 'Bachelors', 99002, 3)
ON CONFLICT (program_id) DO UPDATE SET
    program_name = EXCLUDED.program_name,
    department_id = EXCLUDED.department_id;

INSERT INTO dim_student (
    student_id, reg_no, access_number, first_name, last_name,
    program_id, admission_date, status
) VALUES
('UCU_SEED_T001', 'UCU_SEED_T001', 'S99001', 'Seed', 'StudentOne', 99001, '2020-09-01', 'Active'),
('UCU_SEED_T002', 'UCU_SEED_T002', 'S99002', 'Seed', 'StudentTwo', 99001, '2021-09-01', 'Active'),
('UCU_SEED_T003', 'REG_SEED_003', 'S99003', 'Seed', 'StudentThree', 99002, '2022-09-01', 'Active')
ON CONFLICT (student_id) DO NOTHING;

-- Payments: completed tuition across quarters (student_id matches dim_student; one row uses reg_no as payment key to exercise joins).
INSERT INTO fact_payment (
    payment_id, student_id, date_key, semester_id, year,
    tuition_national, tuition_international, functional_fees,
    amount, payment_method, status, payment_timestamp
) VALUES
('SEED_PAY_2023Q1', 'UCU_SEED_T001', '20230215', 1, 2023, 1200000, 0, 0, 1200000, 'Bank', 'Completed', '2023-02-15 10:00:00'),
('SEED_PAY_2023Q2', 'UCU_SEED_T001', '20230510', 1, 2023, 1150000, 0, 0, 1150000, 'Bank', 'Completed', '2023-05-10 10:00:00'),
('SEED_PAY_2023Q3', 'UCU_SEED_T002', '20230820', 2, 2023, 1320000, 0, 0, 1320000, 'Bank', 'SUCCESS', '2023-08-20 10:00:00'),
('SEED_PAY_2023Q4', 'UCU_SEED_T002', '20231105', 2, 2023, 1280000, 0, 0, 1280000, 'Bank', 'Completed', '2023-11-05 10:00:00'),
('SEED_PAY_2024Q1', 'REG_SEED_003', '20240218', 3, 2024, 1450000, 0, 0, 1450000, 'Bank', 'Completed', '2024-02-18 10:00:00'),
('SEED_PAY_2024Q2', 'UCU_SEED_T001', '20240522', 3, 2024, 1380000, 0, 0, 1380000, 'Bank', 'Completed', '2024-05-22 10:00:00'),
('SEED_PAY_2024Q3', 'UCU_SEED_T002', '20240812', 3, 2024, 1500000, 0, 0, 1500000, 'Mobile', 'Paid', '2024-08-12 10:00:00'),
('SEED_PAY_2024Q4', 'UCU_SEED_T003', '20241130', 4, 2024, 1420000, 0, 0, 1420000, 'Bank', 'Completed', '2024-11-30 10:00:00')
ON CONFLICT (payment_id) DO NOTHING;

COMMIT;
