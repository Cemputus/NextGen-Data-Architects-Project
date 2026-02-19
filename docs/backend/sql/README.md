# SQL Scripts for NextGen-Data-Architects System

This directory contains SQL scripts to create and populate the MySQL databases.

## Files

1. **create_source_db1.sql** - Creates the first source database with:
   - `students` table
   - `courses` table
   - `enrollments` table

2. **create_source_db2.sql** - Creates the second source database with:
   - `students` table
   - `courses` table
   - `attendance` table

3. **create_data_warehouse.sql** - Creates the data warehouse with star schema:
   - Dimension tables: `dim_student`, `dim_course`, `dim_time`, `dim_semester`
   - Fact tables: `fact_enrollment`, `fact_attendance`, `fact_payment`, `fact_grade`

4. **populate_time_dimension.sql** - Populates the time dimension table with dates from 2023-01-01 to 2025-12-31

## Usage

### Option 1: Execute via MySQL Command Line

```bash
# Connect to MySQL
mysql -u root -p

# Execute scripts
source sql/create_source_db1.sql;
source sql/create_source_db2.sql;
source sql/create_data_warehouse.sql;
source sql/populate_time_dimension.sql;
```

### Option 2: Execute via Command Line

```bash
mysql -u root -p < sql/create_source_db1.sql
mysql -u root -p < sql/create_source_db2.sql
mysql -u root -p < sql/create_data_warehouse.sql
mysql -u root -p < sql/populate_time_dimension.sql
```

### Option 3: Use Python Scripts

The Python scripts (`setup_databases.py` and `etl_pipeline.py`) will automatically create the databases and tables if they don't exist. The SQL files are provided for reference and manual execution if needed.

## Database Structure

### Source Database 1 (UCU_SourceDB1)
- **students**: Student information
- **courses**: Course catalog
- **enrollments**: Student course enrollments

### Source Database 2 (UCU_SourceDB2)
- **students**: Student information
- **courses**: Course catalog
- **attendance**: Student attendance records

### Data Warehouse (UCU_DataWarehouse)

#### Dimension Tables
- **dim_student**: Student dimension
- **dim_course**: Course dimension
- **dim_time**: Time dimension (dates from 2023-2025)
- **dim_semester**: Semester dimension

#### Fact Tables
- **fact_enrollment**: Enrollment facts
- **fact_attendance**: Attendance facts (aggregated)
- **fact_payment**: Payment facts
- **fact_grade**: Grade facts

## Notes

- All tables use `InnoDB` engine for transaction support
- Character set is `utf8mb4` for full Unicode support
- Foreign key constraints are enabled with `ON DELETE CASCADE`
- Indexes are created on frequently queried columns
- The time dimension is populated via recursive CTE (requires MySQL 8.0+)

## MySQL Version Requirements

- Minimum: MySQL 5.7 (with manual time dimension population)
- Recommended: MySQL 8.0+ (for recursive CTE support in time dimension)




