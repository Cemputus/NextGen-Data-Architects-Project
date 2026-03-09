-- Populate Time Dimension Table
-- This script populates dim_time with dates from 2023-01-01 to 2025-12-31
-- PostgreSQL version

-- Clear existing time dimension data
TRUNCATE TABLE dim_time;

-- PostgreSQL: use generate_series for date range
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
    d AS date,
    EXTRACT(YEAR FROM d)::INT AS year,
    EXTRACT(QUARTER FROM d)::INT AS quarter,
    EXTRACT(MONTH FROM d)::INT AS month,
    TO_CHAR(d, 'Month') AS month_name,
    EXTRACT(DAY FROM d)::INT AS day,
    EXTRACT(DOW FROM d)::INT AS day_of_week,  -- 0 = Sunday, 6 = Saturday
    TO_CHAR(d, 'Day') AS day_name,
    CASE WHEN EXTRACT(DOW FROM d) IN (0, 6) THEN TRUE ELSE FALSE END AS is_weekend
FROM generate_series('2023-01-01'::DATE, '2025-12-31'::DATE, '1 day'::INTERVAL) AS d;
