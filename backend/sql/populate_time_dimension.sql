-- Populate Time Dimension Table
-- This script populates dim_time with dates from 2023-01-01 to 2025-12-31

USE UCU_DataWarehouse;

-- Clear existing time dimension data
TRUNCATE TABLE dim_time;

-- Insert dates using a stored procedure approach
-- Note: MySQL doesn't have a built-in date series function, so we use a recursive CTE (MySQL 8.0+)
-- For MySQL 5.7, you would need to use a different approach

-- For MySQL 8.0+
WITH RECURSIVE date_series AS (
    SELECT DATE('2023-01-01') as date_value
    UNION ALL
    SELECT DATE_ADD(date_value, INTERVAL 1 DAY)
    FROM date_series
    WHERE date_value < '2025-12-31'
)
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
    DATE_FORMAT(date_value, '%Y%m%d') as date_key,
    date_value as date,
    YEAR(date_value) as year,
    QUARTER(date_value) as quarter,
    MONTH(date_value) as month,
    MONTHNAME(date_value) as month_name,
    DAY(date_value) as day,
    DAYOFWEEK(date_value) - 1 as day_of_week,  -- 0 = Sunday, 6 = Saturday
    DAYNAME(date_value) as day_name,
    CASE WHEN DAYOFWEEK(date_value) IN (1, 7) THEN TRUE ELSE FALSE END as is_weekend
FROM date_series;

-- Alternative for MySQL 5.7 (if recursive CTE not available)
-- You would need to use a numbers table or generate dates via application code




