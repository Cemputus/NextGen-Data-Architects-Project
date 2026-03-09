# SQL Scripts for NextGen-Data-Architects System

This directory contains SQL scripts to create and populate the PostgreSQL databases.

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

### Option 1: Execute via psql Command Line

```bash
# Connect to PostgreSQL
psql -U postgres

# Execute scripts
\i sql/create_source_db1.sql;
\i sql/create_source_db2.sql;
\i sql/create_data_warehouse.sql;
\i sql/populate_time_dimension.sql;
```

### Option 2: Execute via Command Line

```bash
psql -U postgres -f sql/create_source_db1.sql
psql -U postgres -f sql/create_source_db2.sql
psql -U postgres -f sql/create_data_warehouse.sql
psql -U postgres -f sql/populate_time_dimension.sql
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

- All tables use PostgreSQL with full transactional support
- Character encoding is UTF-8 (PostgreSQL default)
- Foreign key constraints are enabled with `ON DELETE CASCADE`
- Indexes are created on frequently queried columns using `CREATE INDEX IF NOT EXISTS`
- The time dimension is populated via PostgreSQL's `generate_series` function

## PostgreSQL Version Requirements

- Minimum: PostgreSQL 13+
- Recommended: PostgreSQL 16+ (used in Docker setup)
