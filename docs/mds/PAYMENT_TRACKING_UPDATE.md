# Payment Tracking Integration - Summary

## Overview
Integrated comprehensive payment tracking with deadline compliance checking into the UCU Data Warehouse system.

## Changes Made

### 1. Database Schema Updates

#### Source Database (`create_source_db1.sql`)
- Added `PaymentDate` (DATETIME) - When payment was made
- Added `PaymentTimestamp` (TIMESTAMP) - Exact timestamp with time component
- Added `PaymentMethod` (VARCHAR(50)) - Payment method (Bank Transfer, Mobile Money, Cash, etc.)
- Added `Status` (VARCHAR(20)) - Payment status (Pending, Completed, Failed, Refunded)
- Added `SemesterStartDate` (DATE) - Semester start date for deadline calculation
- Added `DeadlineMet` (BOOLEAN) - Whether payment met the deadline
- Added `DeadlineType` (VARCHAR(50)) - Which deadline was applicable
- Added `WeeksFromDeadline` (DECIMAL(5,2)) - Weeks from the relevant deadline
- Added `LatePenalty` (DECIMAL(15,2)) - Late penalty amount if applicable

#### Data Warehouse (`create_data_warehouse.sql`)
- Added `payment_timestamp` (DATETIME) - Exact payment timestamp
- Added `semester_start_date` (DATE) - Semester start date for deadline calculation
- Added `deadline_met` (BOOLEAN) - Whether payment met the deadline
- Added `deadline_type` (VARCHAR(50)) - Which deadline: prompt_payment, registration, midterm, full_fees, late_penalty_week1, late_penalty_week2
- Added `weeks_from_deadline` (DECIMAL(5,2)) - Weeks from the relevant deadline (negative if before, positive if after)
- Added `late_penalty` (DECIMAL(15,2)) - Late penalty amount if applicable
- Added indexes for performance: `idx_payment_timestamp`, `idx_deadline_met`, `idx_deadline_type`

### 2. ETL Pipeline Updates (`etl_pipeline.py`)

#### Transform Phase
- Extracts `PaymentDate`, `PaymentTimestamp`, `SemesterStartDate` from source data
- Handles missing timestamp fields gracefully
- Calculates semester start dates based on semester name and year if not provided

#### Load Phase
- Extracts payment timestamps from source data
- Calculates semester start dates based on semester_id and year if not provided
- **Integrates Payment Deadlines Utility** to check deadline compliance:
  - Calculates UCU payment deadlines based on semester start date
  - Determines which deadline each payment relates to
  - Calculates weeks from deadline (negative = before, positive = after)
  - Calculates late penalties based on deadline type and outstanding amounts
  - Sets `deadline_met`, `deadline_type`, `weeks_from_deadline`, and `late_penalty` fields

### 3. Data Generation Updates (`setup_databases.py`)

#### `generate_student_fees()` Function
- Now generates realistic payment dates and timestamps
- Calculates semester start dates based on semester name:
  - Jan (Easter): January 15
  - May (Trinity): May 15
  - September (Advent): August 29 (based on provided image)
- Generates payment dates ranging from 2 weeks before to 4 months after semester start
- Includes payment timestamps with time components (hours, minutes, seconds)
- Generates payment methods (Bank Transfer, Mobile Money, Cash, Credit Card, Cheque)
- Ensures payment dates are not in the future

### 4. Payment Deadlines Utility (`utils/payment_deadlines.py`)

Created comprehensive utility for UCU payment deadline management:

#### Features:
- **`calculate_payment_deadlines(semester_start_date)`**: Calculates all payment deadlines from semester start date
- **`calculate_required_payment()`**: Calculates required payment amount based on deadline and student type (resident/non-resident)
- **`get_current_deadline_status()`**: Gets current deadline status based on today's date

#### UCU Payment Deadlines (from image):
1. **Prompt Payment Option** (Week 0): 50% or 100% of Tuition & Other fees + 100% Accommodation for Residents
2. **Registration Deadline** (Week 4): 45% to 100% Tuition and Other fees + 100% Accommodation for Residents
3. **Midterm Deadline** (Week 8): At least 75% of Tuition & Other fees
4. **Full Fees Deadline** (Week 11): 100%
5. **Late Payment - Week 1** (Week 12): All Fees + 5% penalty
6. **Late Payment - Week 2** (Week 13): All Fees + 10% penalty

## How It Works

1. **Payment Creation**: When a payment is created, it includes:
   - Payment timestamp (exact date and time)
   - Semester start date
   - Payment amount and breakdown

2. **Deadline Calculation**: During ETL load phase:
   - System calculates all UCU payment deadlines for the semester
   - Compares payment date with each deadline
   - Determines which deadline the payment relates to
   - Calculates weeks from deadline

3. **Late Penalty Calculation**: If payment is late:
   - Calculates outstanding amount (total required - amount paid)
   - Applies penalty percentage based on deadline type
   - Stores penalty amount in `late_penalty` field

4. **Deadline Compliance**: System tracks:
   - Whether payment met the deadline (`deadline_met`)
   - Which deadline it relates to (`deadline_type`)
   - How many weeks before/after deadline (`weeks_from_deadline`)

## Benefits

1. **Complete Payment Tracking**: Every payment is tracked with exact timestamp
2. **Deadline Compliance**: Automatic checking of payment deadlines
3. **Late Penalty Calculation**: Automatic calculation of late fees
4. **Analytics Ready**: Data is structured for deadline compliance analytics
5. **Prediction Ready**: Deadline data can be used in student performance predictions

## Usage in Predictions

The deadline compliance data can be integrated into student performance predictions:
- Students who pay on time vs. late
- Correlation between payment timing and academic performance
- Risk factors based on payment behavior

## Next Steps

1. Test the ETL pipeline with the new payment tracking fields
2. Verify deadline calculations are correct
3. Integrate deadline data into student performance predictions
4. Create analytics dashboards showing payment deadline compliance

