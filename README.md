# UCU Analytics & Prediction System

A comprehensive data analytics and machine learning platform for Uganda Christian University (UCU), designed to provide insights into student performance, attendance, payment patterns, and predictive analytics for academic success.

## 📋 Table of Contents

- [System Overview](#system-overview)
- [Architecture](#architecture)
- [Key Features](#key-features)
- [Machine Learning Models](#machine-learning-models)
- [Technology Stack](#technology-stack)
- [Installation &amp; Setup](#installation--setup)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [ETL Pipeline](#etl-pipeline)
- [Security &amp; RBAC](#security--rbac)
- [Frontend Dashboard](#frontend-dashboard)
- [Usage Examples](#usage-examples)
- [Recent changes (Admin, export, KPIs)](#recent-changes-admin-export-kpis)
- [Troubleshooting](#troubleshooting)

---

## 📌 Recent changes (Admin, export, KPIs)

The following updates were made to the Admin console, export behaviour, and KPI definitions:

### Admin console

- **Refresh**: One **Refresh** button at the top of the Admin page refreshes all KPIs, user list, and audit logs in one go.
- **KPIs after user changes**: Adding, editing, or deleting a user from the Admin user list automatically refreshes KPI counts (e.g. Total users, Employees, Staff) so the dashboard stays in sync.
- **Employees & Staff KPIs**:
  - **Employees**: ETL count from `dim_employee` **plus** all app users (non-students) from `ucu_rbac.app_users`. Subtitle: *"ETL (dim_employee) + all app users (non-students). Refresh after ETL."*
  - **Staff**: ETL count from `dim_employee` **plus** app users with role **Staff** only. Subtitle: *"ETL (dim_employee) + app users with role Staff. Refresh after ETL."*
  - If the RBAC database is empty or unreachable, demo app users are used as a fallback so the KPIs show at least **Employees: 8** and **Staff: 1** (no zero counts).
- **Total users**: Subtitle clarified as *"Students (warehouse) + app users (all roles)"* (no separate "incl. X staff" line).
- **Recent ETL runs**: The ETL KPI card is labelled **"Recent ETL runs"** with subtitle *"Last 50 runs (log files)"*; the backend returns at most 50 runs so the number is capped and clearly refers to run history, not employee count.

### Export (Admin)

- **Full admin export**: Excel and PDF export from the Admin console now include **all** admin data: summary KPIs, **users** (up to 500), **audit logs** (up to 500), **ETL runs**, and **warehouse** table counts—not only the KPI summary.

### User management (HR/Finance)

- When adding **HR** or **Finance** users via the Admin user form, **faculty** and **department** can be selected and are sent to the backend (`faculty_id`, `department_id`); they are stored for the new user so HR/Finance are no longer left unassigned.

### Technical notes

- Admin KPIs use the same RBAC connection as the main app (`ucu_rbac`); if the SQLAlchemy path fails, a direct PyMySQL fallback to `ucu_rbac` is used for app user counts.
- Demo user fallback ensures Employees and Staff KPIs are never zero when `ucu_rbac` is empty or unavailable.

---

## 🎯 System Overview

The UCU Analytics & Prediction System is a full-stack web application that provides:

- **Real-time Analytics**: Comprehensive dashboards for students, faculty, and administrators
- **Predictive Analytics**: ML-powered predictions for student performance, attendance, and payment patterns
- **Role-Based Access Control**: Secure multi-role system (Student, Staff, HOD, Dean, Senate, Finance, HR, Analyst, System Admin)
- **Data Warehousing**: Star schema data warehouse for efficient analytics
- **ETL Pipeline**: Automated data extraction, transformation, and loading from source systems

---

## 🏗️ Architecture

### System Components

```
┌─────────────────┐
│   Frontend      │  React.js + Tailwind CSS + SciChart.js
│   (React)       │
└────────┬────────┘
         │ HTTP/REST
┌────────▼────────┐
│   Backend API   │  Flask + JWT Authentication
│   (Flask)       │
└────────┬────────┘
         │ SQL
┌────────▼────────┐
│  Data Warehouse │  MySQL (Star Schema)
│  (MySQL)        │
└────────┬────────┘
         │
┌────────▼────────┐
│  Source Data    │  CSV Files / Source DB
│  (Bronze)       │
└─────────────────┘
```

### Data Flow

1. **ETL Pipeline** extracts data from source systems (CSV files)
2. Data is transformed and loaded into **Bronze** (raw), **Silver** (cleaned), and **Gold** (aggregated) layers
3. **Data Warehouse** (Star Schema) stores dimension and fact tables
4. **Backend API** queries the warehouse and serves analytics
5. **ML Models** are trained on warehouse data and provide predictions
6. **Frontend** displays dashboards and visualizations

---

## ✨ Key Features

### 1. **Multi-Role Dashboards**

- **Student Dashboard**: Personal performance, attendance, payment status
- **Staff Dashboard**: Class-level analytics and student management (assigned courses only)
- **HOD Dashboard**: Department-wide insights and trends; assign classes to staff
- **Dean Dashboard**: Faculty-level analytics and performance metrics
- **Senate Dashboard**: University-wide statistics and trends
- **Finance Dashboard**: Payment tracking, revenue analysis, and financial reports
- **HR Dashboard**: Staff management and HR analytics
- **Analyst Workspace**: Create workspaces, dashboards, analytics, FEX and high school analyses, reports, and predictions
- **System Admin (Sysadmin) Console**: User management, settings, ETL jobs, audit logs

### 2. **Advanced Analytics**

- **FEX Analytics**: Failed Exam analysis with drill-down capabilities
- **High School Analytics**: Enrollment patterns, retention rates, and performance by high school
- **Payment Analytics**: Payment trends, completion rates, and outstanding balances
- **Attendance Analytics**: Attendance patterns and correlation with performance

### 3. **Predictive Analytics**

- Student performance prediction
- Tuition-attendance-performance correlation
- Scenario analysis (what-if predictions)
- Batch predictions for multiple students

### 4. **Data Export**

- Excel export for all analytics
- PDF report generation
- Customizable filters and date ranges
- **Admin console**: Full export (Excel/PDF) includes KPIs, users, audit logs, ETL runs, and warehouse counts (not only KPIs)

---

## 🤖 Machine Learning Models

### 1. **Standard Performance Prediction Models**

#### **Random Forest Regressor**

- **Purpose**: Predict student average grade based on historical data
- **Why Used**:
  - Handles non-linear relationships well
  - Robust to outliers
  - Provides feature importance
  - Good performance with mixed data types
- **Features**: 42 features including demographics, attendance, payments, grades, high school metrics
- **Performance**: R² = 0.9992, RMSE = 0.71

#### **Gradient Boosting Regressor**

- **Purpose**: Alternative ensemble method for performance prediction
- **Why Used**:
  - Sequential learning improves accuracy
  - Better handling of complex patterns
  - Strong performance on regression tasks
- **Performance**: R² = 0.9995, RMSE = 0.59 (Best performing)

#### **Neural Network (MLPRegressor)**

- **Purpose**: Deep learning approach for performance prediction
- **Why Used**:
  - Captures complex non-linear relationships
  - Good for large feature spaces
  - Can learn hierarchical patterns
- **Performance**: R² = 0.9961, RMSE = 1.58

**Model Selection**: The system uses an ensemble approach, averaging predictions from all three models for maximum accuracy.

---

### 2. **Enhanced Prediction Models**

#### **Tuition-Attendance-Performance Model**

- **Type**: Gradient Boosting Regressor
- **Purpose**: Predict student performance based on tuition payment timeliness and attendance patterns
- **Why Used**:
  - Identifies at-risk students early
  - Helps financial aid and academic support teams intervene proactively
  - Combines financial and behavioral indicators
- **Features**:
  - Payment completion rate
  - Total paid/pending amounts
  - Completed payments count
  - Days since last payment
  - Attendance rate
  - Total attendance hours
  - Courses attended
  - Combined attendance-payment score
- **Use Case**: Early intervention for students with payment delays and poor attendance

#### **Enrollment Trend Model**

- **Type**: Random Forest Regressor
- **Purpose**: Predict enrollment trends for resource allocation
- **Why Used**:
  - Helps plan course offerings
  - Optimizes resource allocation (classrooms, faculty)
  - Identifies enrollment patterns by program/department
- **Features**: Year, quarter, program, department, faculty, historical enrollment data, lag features

#### **Foundational Course Performance Model**

- **Type**: Gradient Boosting Regressor
- **Purpose**: Predict performance in foundational courses
- **Why Used**:
  - Identifies students struggling with core courses
  - Helps design intervention programs
  - Predicts success in advanced courses
- **Features**: Course characteristics, student background, previous performance

---

### 3. **Model Training & Evaluation**

**Training Process**:

1. Data extraction from data warehouse
2. Feature engineering and selection
3. Train-test split (80/20)
4. Feature scaling (StandardScaler)
5. Model training with cross-validation
6. Model evaluation (R², RMSE, MAE)
7. Model persistence (pickle files)

**Model Storage**:

- Standard models: `backend/models/multi_model_predictor.pkl`
- Enhanced models: `backend/models/enhanced_predictor.pkl`

**Retraining**: Models can be retrained using:

```bash
cd backend
python train_models.py
```

---

## 🛠️ Technology Stack

### Backend Stack

#### Core Framework & Runtime

- **Python**: 3.8+
- **Flask**: 2.3.0+ - Web framework
- **Flask-CORS**: Cross-origin resource sharing
- **Flask-JWT-Extended**: JWT authentication and authorization

#### Database & ORM

- **MySQL**: 8.0+ - Relational database
- **SQLAlchemy**: 2.0+ - SQL toolkit and ORM
- **PyMySQL**: MySQL database connector
- **pymysql**: Pure Python MySQL client

#### Machine Learning & Data Science

- **scikit-learn**: 1.3.0+ - Machine learning library
  - RandomForestRegressor
  - GradientBoostingRegressor
  - MLPRegressor (Neural Network)
  - StandardScaler, LabelEncoder
- **pandas**: 2.0+ - Data manipulation and analysis
- **numpy**: 1.24+ - Numerical computing

#### Data Processing & ETL

- **pandas**: 1.5.0+ - Data transformation and cleaning
- **numpy**: 1.23.0+ - Numerical operations
- **pyarrow**: 10.0.0+ - Columnar data processing

#### Utilities & Tools

- **python-dotenv**: 1.0.0 - Environment variable management
- **bcrypt**: 4.1.2 - Password hashing
- **openpyxl**: 3.1.0+ - Excel file generation
- **reportlab**: 4.0.7 - PDF generation
- **pickle**: Built-in - Model serialization
- **requests**: 2.31.0 - HTTP library
- **cryptography**: 3.4.0+ - Cryptographic primitives
- **pyarrow**: 10.0.0+ - Apache Arrow integration
- **werkzeug**: 3.0.1 - WSGI utilities

#### Development & Testing

- **pytest**: Testing framework (optional)
- **python-dateutil**: Date utilities

### Frontend Stack

#### Core Framework

- **React**: 18.2.0+ - UI library
- **React DOM**: 18.2.0+ - React rendering
- **React Router DOM**: 6.8+ - Client-side routing

#### Build Tools

- **Create React App**: React application scaffolding
- **Webpack**: Module bundler (via CRA)
- **Babel**: JavaScript compiler
- **PostCSS**: CSS processing

#### Styling & UI

- **Tailwind CSS**: 3.3+ - Utility-first CSS framework
- **PostCSS**: 8.5.6 - CSS post-processing
- **Autoprefixer**: 10.4.22 - CSS vendor prefixing
- **tailwindcss-animate**: 1.0.7 - Animation utilities
- **tailwind-merge**: 3.4.0 - Merge Tailwind classes
- **clsx**: 2.1.1 - Conditional class names
- **class-variance-authority**: 0.7.1 - Component variants

#### Data Visualization

- **SciChart.js**: 4.0.920 - High-performance charting library (primary)
  - SciChart2D
  - XyDataSeries, FastLineRenderableSeries
  - NumericAxis, CategoryAxis
- **Recharts**: 2.10.3 - Composable charting library (fallback)
  - ResponsiveContainer, LineChart, BarChart, AreaChart
  - PieChart (via stacked column alternative)
- **Plotly.js**: 2.27.0 - Interactive charting library
  - react-plotly.js: 2.6.0 - React wrapper for Plotly

#### HTTP & API

- **Axios**: 1.4+ - HTTP client for API requests
- **Fetch API**: Native browser API (fallback)

#### Icons & UI Components

- **Lucide React**: 0.554.0 - Modern icon library
- **React Icons**: 4.12.0 - Additional icon sets
- **Chakra UI**: 2.8.2 - Component library (if used)
  - @emotion/react: 11.11.1
  - @emotion/styled: 11.11.0
  - framer-motion: 10.16.16
- **Radix UI**: @radix-ui/react-tabs - Accessible UI primitives

#### State Management

- **React Hooks**: Built-in state management
  - useState, useEffect, useContext
  - Custom hooks for API calls

#### Export & File Handling

- **ExcelJS**: 4.4.0 - Excel file generation
- **xlsx**: 0.18.5 - Excel file parsing
- **file-saver**: 2.0.5 - File download utility
- **jspdf**: 3.0.4 - PDF generation
- **jspdf-autotable**: 5.0.2 - PDF table generation
- **html2canvas**: 1.4.1 - HTML to canvas conversion

#### Date & Time

- **date-fns**: 2.30.0 - Date utility library

#### Tables & Data Display

- **react-table**: 7.8.0 - Table component
- **react-select**: 5.8.0 - Select dropdown component

#### Development Tools

- **ESLint**: Code linting
- **Prettier**: Code formatting (if configured)

### Data Pipeline Stack

#### ETL Framework

- **Custom Python Pipeline**: Built with pandas and SQLAlchemy
- **Data Layers**:
  - **Bronze**: Raw data storage (CSV files)
  - **Silver**: Cleaned and validated data
  - **Gold**: Aggregated and transformed data

#### Data Warehouse

- **MySQL 8.0+**: Star schema design
- **InnoDB Engine**: Transactional storage
- **Indexes**: Optimized for query performance
- **Foreign Keys**: Referential integrity

#### Data Formats

- **CSV**: Source data format
- **JSON**: API data exchange
- **Excel (.xlsx)**: Export format
- **PDF**: Report generation

### Infrastructure & Deployment

#### Server

- **Development**: Flask development server
- **Production**: Gunicorn (recommended) or uWSGI
- **WSGI**: Python Web Server Gateway Interface

#### Database

- **MySQL 8.0+**: Primary database
- **InnoDB**: Storage engine with ACID compliance
- **Character Set**: utf8mb4 (full Unicode support)

#### File Storage

- **Local Filesystem**: CSV, PDF, Excel exports
- **Model Storage**: Pickle files in `backend/models/`

#### Security

- **JWT**: JSON Web Tokens for authentication
- **bcrypt**: Password hashing (bcrypt algorithm)
- **CORS**: Cross-origin resource sharing enabled
- **RBAC**: Role-based access control

### Development Environment

#### Version Control

- **Git**: Source control
- **GitHub/GitLab**: Repository hosting

#### IDE & Tools

- **VS Code / PyCharm**: Development IDEs
- **MySQL Workbench**: Database management
- **Postman / Insomnia**: API testing

#### Package Management

- **pip**: Python package manager
- **npm / yarn**: Node.js package manager

### Complete Dependency List

#### Backend (`requirements.txt`)

```
flask==3.0.0
flask-cors==4.0.0
flask-jwt-extended==4.6.0
pandas>=1.5.0,<2.1.0
numpy>=1.23.0,<1.25.0
sqlalchemy>=1.4.0,<2.1.0
scikit-learn>=1.0.0,<1.4.0
reportlab==4.0.7
python-dotenv==1.0.0
werkzeug==3.0.1
bcrypt==4.1.2
pymysql==1.1.0
cryptography>=3.4.0,<42.0.0
openpyxl>=3.1.0
requests==2.31.0
pyarrow>=10.0.0,<14.0.0
plotly==5.18.0
dash==2.14.2
dash-bootstrap-components==1.5.0
```

#### Frontend (`package.json`)

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "axios": "^1.6.2",
    "@chakra-ui/react": "^2.8.2",
    "@emotion/react": "^11.11.1",
    "@emotion/styled": "^11.11.0",
    "@radix-ui/react-tabs": "^1.1.13",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "date-fns": "^2.30.0",
    "exceljs": "^4.4.0",
    "file-saver": "^2.0.5",
    "framer-motion": "^10.16.16",
    "html2canvas": "^1.4.1",
    "jspdf": "^3.0.4",
    "jspdf-autotable": "^5.0.2",
    "lucide-react": "^0.554.0",
    "plotly.js": "^2.27.0",
    "react-icons": "^4.12.0",
    "react-plotly.js": "^2.6.0",
    "react-select": "^5.8.0",
    "react-table": "^7.8.0",
    "recharts": "^2.10.3",
    "scichart": "^4.0.920",
    "tailwind-merge": "^3.4.0",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "react-scripts": "^5.0.1",
    "autoprefixer": "^10.4.22",
    "postcss": "^8.5.6",
    "tailwindcss-animate": "^1.0.7",
    "@types/node": "^24.10.1"
  }
}
```

### System Requirements

#### Minimum Requirements

- **OS**: Windows 10+, Linux (Ubuntu 20.04+), macOS 10.15+
- **Python**: 3.8 or higher
- **Node.js**: 16.0 or higher
- **MySQL**: 8.0 or higher
- **RAM**: 4GB minimum (8GB recommended)
- **Storage**: 2GB free space

#### Recommended Requirements

- **OS**: Windows 11, Linux (Ubuntu 22.04+), macOS 12+
- **Python**: 3.10 or higher
- **Node.js**: 18.0 or higher
- **MySQL**: 8.0.30 or higher
- **RAM**: 8GB or more
- **Storage**: 5GB+ free space
- **CPU**: Multi-core processor (2+ cores)

---

## 📦 Installation & Setup

### Prerequisites

- Python 3.8+
- Node.js 16+
- MySQL 8.0+
- Git

### Backend Setup

1. **Clone the repository**

```bash
git clone <https://github.com/Cemputus/NextGen-Data-Architects-Project>
cd "NextGen-Data-Architects-Project"
```

2. **Set up Python virtual environment**

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# Linux/Mac
source .venv/bin/activate
```

3. **Install dependencies**

```bash
pip install -r requirements.txt
```

4. **Configure database**

- Edit `backend/config.py` with your MySQL credentials:

```python
MYSQL_HOST = 'localhost'
MYSQL_USER = 'your_username'
MYSQL_PASSWORD = 'your_password'
MYSQL_DATABASE = 'UCU_DataWarehouse'
```

5. **Create database and run ETL**

```bash
# Create database schema
python setup_databases.py

# Run ETL pipeline
python etl_pipeline.py
```

6. **Train ML models**

```bash
python train_models.py
```

7. **Start backend server**

```bash
python app.py
# Or use the batch file
start_backend.bat
```

Backend will run on `http://localhost:5000`

### Frontend Setup

1. **Navigate to frontend directory**

```bash
cd frontend
```

2. **Install dependencies**

```bash
npm install
```

3. **Start development server**

```bash
npm start
```

Frontend will run on `http://localhost:3000`

### Quick Start (Windows)

Use the provided batch files:

```bash
# Start both backend and frontend
start_all_services.bat

# Or start individually
start_backend.bat
# Then in another terminal:
cd frontend && npm start
```

---

## 📚 API Documentation

### Authentication

#### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "identifier": "dean",
  "password": "dean123"
}
```

**Response**:

```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user": {
    "username": "dean",
    "role": "Dean",
    "faculty_id": 1
  }
}
```

### Dashboard Endpoints

All dashboard endpoints require JWT authentication. Include token in header:

```http
Authorization: Bearer <access_token>
```

#### Dashboard Statistics

```http
GET /api/dashboard/stats
```

Returns: Total students, courses, average grade, payment statistics

#### Payment Trends

```http
GET /api/dashboard/payment-trends
```

Returns: Payment trends over time (Finance role only)

#### Grade Distribution

```http
GET /api/dashboard/grade-distribution
```

Returns: Distribution of grades across the system

### Analytics Endpoints

#### FEX Analytics

```http
GET /api/analytics/fex?drilldown=overall
```

**Drilldown options**: `overall`, `faculty`, `department`, `program`, `course`

#### High School Analytics

```http
GET /api/analytics/high-school
```

Returns: Enrollment, retention, and performance by high school

### Prediction Endpoints

#### Student Performance Prediction

```http
POST /api/predictions/predict
Content-Type: application/json
Authorization: Bearer <token>

{
  "student_id": "J21B05/001",
  "model_type": "ensemble"
}
```

**Response**:

```json
{
  "student_id": "J21B05/001",
  "predicted_grade": 75.5,
  "predicted_letter_grade": "B+",
  "confidence": 0.95
}
```

#### Tuition-Attendance-Performance Prediction

```http
POST /api/predictions/tuition-attendance-performance
Content-Type: application/json
Authorization: Bearer <token>

{
  "student_id": "J21B05/001"
}
```

#### Scenario Analysis

```http
POST /api/predictions/scenario
Content-Type: application/json
Authorization: Bearer <token>

{
  "student_id": "J21B05/001",
  "scenarios": [
    {
      "name": "Improved Attendance",
      "attendance_rate": 90,
      "payment_completion_rate": 100
    }
  ]
}
```

### HOD Endpoints (assign classes to staff)

All require `Authorization: Bearer <token>` and HOD role with department assigned.

#### Department courses

```http
GET /api/hod/department-courses
```

Returns: `{ "courses": [ { "course_code": "...", "course_name": "..." }, ... ] }` for courses in the HOD’s department.

#### Staff in department

```http
GET /api/hod/staff-in-department
```

Returns: `{ "staff": [ { "id": 1, "username": "...", "full_name": "..." }, ... ] }`.

#### Get staff course assignments

```http
GET /api/hod/staff-assignments/<staff_id>
```

Returns: `{ "course_codes": ["CODE1", "CODE2", ... ] }`. 404 if staff is not in HOD’s department.

#### Set staff course assignments

```http
PUT /api/hod/staff-assignments/<staff_id>
Content-Type: application/json

{ "course_codes": ["CODE1", "CODE2"] }
```

Replaces assignments for that staff. 404 if staff is not in HOD’s department.

### Export Endpoints

```http
GET /api/export/excel?type=dashboard&faculty_id=1
```

#### PDF Export

```http
GET /api/export/pdf?type=fex&department_id=5
```

---

## 🗄️ Database Schema

### Star Schema Design

#### Dimension Tables

**dim_student**

- `student_id` (PK)
- `access_number`, `reg_no`
- `first_name`, `last_name`, `email`
- `gender`, `nationality`
- `admission_date`
- `high_school`, `high_school_district`
- `program_id`, `year_of_study`, `status`

**dim_course**

- `course_code` (PK)
- `course_name`
- `credits`
- `department`

**dim_time**

- `date_key` (PK) - Format: YYYYMMDD
- `date`, `year`, `quarter`, `month`
- `month_name`, `day`, `day_of_week`, `day_name`
- `is_weekend`

**dim_semester**

- `semester_id` (PK)
- `semester_name`
- `academic_year`

**dim_program**

- `program_id` (PK)
- `program_name`
- `degree_level`
- `department_id` (FK)
- `duration_years`

**dim_department**

- `department_id` (PK)
- `department_name`
- `faculty_id` (FK)
- `head_of_department`

**dim_faculty**

- `faculty_id` (PK)
- `faculty_name`
- `dean_name`

#### RBAC & App Users (MySQL)

**app_users** (in RBAC database)

- `id` (PK), `username`, `password_hash`, `role`, `full_name`
- `faculty_id`, `department_id` (for staff, HOD, dean)
- Staff must have both `faculty_id` and `department_id` set.

**staff_course_assignments** (in RBAC database)

- `app_user_id` (PK, FK → app_users.id ON DELETE CASCADE)
- `course_code` (PK)
- Defines which courses each staff user can see; only students in these courses appear in staff dashboards. HODs manage assignments via the "Assign classes" UI or API.

#### Fact Tables

**fact_enrollment**

- `enrollment_id` (PK)
- `student_id` (FK)
- `course_code` (FK)
- `date_key` (FK)
- `semester_id` (FK)
- `status`

**fact_attendance**

- `attendance_id` (PK)
- `student_id` (FK)
- `course_code` (FK)
- `date_key` (FK)
- `total_hours`
- `days_present`
- `days_absent`

**fact_payment**

- `payment_id` (PK)
- `student_id` (FK)
- `date_key` (FK)
- `amount`
- `status` (Completed/Pending/Failed)
- `payment_type` (Tuition/Functional Fees)

**fact_grade**

- `grade_id` (PK)
- `student_id` (FK)
- `course_code` (FK)
- `date_key` (FK)
- `coursework_score`
- `exam_score`
- `grade`
- `exam_status` (Completed/MEX/FEX/FCW)
- `absence_reason`

---

## 🔄 ETL Pipeline

### Data Flow

```
Source Data (CSV)
    ↓
Bronze Layer (Raw Data)
    ↓
Silver Layer (Cleaned Data)
    ↓
Gold Layer (Aggregated Data)
    ↓
Data Warehouse (Star Schema)
```

### ETL Process

1. **Extract**: Read CSV files from `backend/data/source_data*.csv`
2. **Transform**:
   - Data cleaning (handle missing values, duplicates)
   - Data type conversion
   - Standardization (names, dates, formats)
   - Data validation
3. **Load**:
   - Create dimension tables
   - Populate fact tables
   - Create indexes for performance
   - Set up foreign key relationships

### Running ETL

```bash
cd backend
python etl_pipeline.py
```

ETL logs are saved in `backend/logs/etl_pipeline_*.log`

---

## 🔐 Security & RBAC

### Role-Based Access Control (RBAC)

The system implements a comprehensive RBAC system with the following roles:

#### Roles & Permissions

1. **Student**

   - View own performance, attendance, payments
   - Access personal predictions
   - No administrative access
2. **Staff**

   - View class-level analytics only for **assigned courses** (no department-wide access)
   - Staff must be assigned to a **faculty** and **department**; an HOD assigns which **classes/courses** they can see
   - Access students in assigned courses only; limited prediction access
3. **HOD (Head of Department)**

   - View department-wide analytics
   - **Assign classes to staff**: manage which courses each staff user can see (Assign classes page and API)
   - Access all students in department; department-level predictions
4. **Dean**

   - View faculty-wide analytics
   - Access all students in faculty
   - Faculty-level predictions and reports
5. **Senate**

   - Full system access
   - University-wide analytics
   - All predictions and reports
   - System administration
6. **Finance**

   - Payment analytics and reports
   - Financial predictions
   - Payment tracking
7. **HR (Human Resource)**

   - Staff management (view and manage HR-related staff data)
   - HR analytics and dashboard
   - Optional department assignment
8. **Analyst**

   - Create and use **workspaces** and **dashboards**
   - Build analytics, FEX analysis, high school analysis, and reports
   - Access predictions and scenario analysis
   - University-wide data access for building views; no user or system administration
9. **System Admin (Sysadmin)**

   - Full user management: create, edit, delete app users (students, staff, HOD, dean, HR, finance, analyst)
   - Admin console: dashboard, users, settings, ETL jobs, audit logs
   - Only sysadmin can access `/admin/*` routes and user-management APIs

### Authentication

- **JWT Tokens**: Access tokens (24h expiry) and refresh tokens (30 days)
- **Password Hashing**: bcrypt for secure password storage
- **Token Refresh**: Automatic token refresh mechanism

### Data Scoping

All queries are automatically scoped based on user role:

- **Students**: only their own data
- **Staff**: only data for students in **assigned courses** (from `staff_course_assignments`); staff with no assignments see no dashboard data until an HOD assigns classes
- **HOD**: department data
- **Dean**: faculty data
- **Senate**: all data (university-wide)
- **HR**: dashboard and staff management (scope depends on backend configuration)
- **Analyst**: university-wide data for building workspaces, dashboards, and analytics (no scope restriction)
- **Finance**: payment-related data
- **Sysadmin**: no data-warehouse scope; access to RBAC, user management, ETL, and audit logs

### Staff course assignments and HOD assign-classes

- **Table**: `staff_course_assignments` stores `(app_user_id, course_code)` so each staff user is restricted to specific courses. The table is created automatically at backend startup (RBAC DB).
- **Scoping**: Dashboard and analytics for role **Staff** use `_get_staff_assigned_course_codes(identity)`; if the list is empty, staff see no data (`1=0`); otherwise only students enrolled in those course codes are included.
- **HOD API**: HODs can list department courses (`GET /api/hod/department-courses`), list staff in department (`GET /api/hod/staff-in-department`), and get/update assignments per staff (`GET`/`PUT /api/hod/staff-assignments/<staff_id>` with body `{ "course_codes": ["CODE1", "CODE2"] }`). Only staff in the HOD’s department can be managed.
- **HOD UI**: Under **HOD → Assign classes**, HODs see all staff in their department and a multi-select of department courses per staff; saving updates assignments via `PUT /api/hod/staff-assignments/<staff_id>`.

---

## 🎨 Frontend Dashboard

### Dashboard Components

1. **Student Dashboard**

   - Personal performance metrics
   - Attendance calendar
   - Payment status
   - Grade history
   - Performance predictions
2. **Staff Dashboard**

   - Class performance overview for **assigned courses only** (assigned by HOD via Assign classes)
   - Student list with filters (scoped to assigned classes)
   - Attendance tracking
   - Grade entry interface
3. **HOD Dashboard**

   - Department statistics
   - **Assign classes**: assign courses to staff in the department (staff then see only those courses)
   - Program performance
   - Student distribution
   - Department trends
4. **Dean Dashboard**

   - Faculty-wide metrics
   - Program comparisons
   - High school analytics
   - Faculty performance reports
5. **Senate Dashboard**

   - University-wide statistics
   - Cross-faculty comparisons
   - Enrollment trends
   - System-wide analytics
6. **Finance Dashboard**

   - Payment tracking
   - Revenue analytics
   - Outstanding balances
   - Payment trends
7. **HR Dashboard**

   - HR dashboard and analytics
   - Staff management (HR staff view)
   - Profile
8. **Analyst Workspace**

   - Create and manage **workspaces** and **dashboards**
   - Build analytics, FEX analysis, high school analysis, and reports
   - Predictions and scenario analysis
   - No user or system administration; focused on creating and viewing analytics
9. **System Admin Console**

   - Admin dashboard (console) with one **Refresh** button to reload KPIs, users, and audit logs
   - **KPIs**: Total users (students + app users), Employees (ETL dim_employee + all app users), Staff (ETL + app users with role Staff), Recent ETL runs (last 50), system health
   - Users: view, create, edit, delete app users (HR/Finance can have faculty and department assigned)
   - Settings, ETL jobs, audit logs
   - Full export: Excel/PDF with KPIs, users, audit logs, ETL runs, warehouse counts
   - Profile

### Chart Library

- **Primary**: SciChart.js (high-performance charts)
- **Fallback**: Recharts (if SciChart fails to load)
- **Chart Types**: Line, Bar, Area, Stacked Column, Pie (via stacked column)

---

## 💡 Usage Examples

### Example 1: Predict Student Performance

```python
import requests

# Login
response = requests.post('http://localhost:5000/api/auth/login', json={
    'identifier': 'dean',
    'password': 'dean123'
})
token = response.json()['access_token']

# Predict performance
headers = {'Authorization': f'Bearer {token}'}
response = requests.post(
    'http://localhost:5000/api/predictions/predict',
    json={'student_id': 'J21B05/001', 'model_type': 'ensemble'},
    headers=headers
)
print(response.json())
```

### Example 2: Get FEX Analytics

```python
response = requests.get(
    'http://localhost:5000/api/analytics/fex?drilldown=department',
    headers=headers
)
data = response.json()
print(f"Total FEX: {data['summary']['total_fex']}")
```

### Example 3: Scenario Analysis

```python
response = requests.post(
    'http://localhost:5000/api/predictions/scenario',
    json={
        'student_id': 'J21B05/001',
        'scenarios': [
            {
                'name': 'Improved Attendance',
                'attendance_rate': 90,
                'payment_completion_rate': 100
            }
        ]
    },
    headers=headers
)
```

---

## 🔧 Troubleshooting

### Common Issues

1. **"Model not trained" error**

   ```bash
   cd backend
   python train_models.py
   ```
2. **Database connection error**

   - Check MySQL is running
   - Verify credentials in `config.py`
   - Ensure database exists
3. **Port already in use**

   - Change port in `app.py` or `start_server.py`
   - Kill existing process: `netstat -ano | findstr :5000`
4. **Frontend not connecting to backend**

   - Check CORS settings in `app.py`
   - Verify backend is running on port 5000
   - Check API base URL in frontend
5. **Charts not rendering**

   - Check browser console for errors
   - Verify SciChart.js WASM files are accessible
   - System will fallback to Recharts automatically

### Logs

- **Backend logs**: Console output when running `python app.py`
- **ETL logs**: `backend/logs/etl_pipeline_*.log`
- **Frontend logs**: Browser console (F12)

---

## 📊 Model Performance Summary

| Model              | Type       | R² Score | RMSE | Use Case                              |
| ------------------ | ---------- | --------- | ---- | ------------------------------------- |
| Random Forest      | Regression | 0.9992    | 0.71 | General performance prediction        |
| Gradient Boosting  | Regression | 0.9995    | 0.59 | General performance prediction (best) |
| Neural Network     | Regression | 0.9961    | 1.58 | Complex pattern recognition           |
| Tuition-Attendance | Regression | -0.42     | 4.86 | Early intervention prediction         |
| Enrollment Trend   | Regression | -         | -    | Resource allocation                   |

**Note**: Negative R² scores indicate the model needs more training data or feature engineering.

---

## 🚀 Future Enhancements

- [ ] Real-time data streaming
- [ ] Advanced visualization dashboards
- [ ] Mobile app integration
- [ ] Automated report scheduling
- [ ] Email notifications for predictions
- [ ] Integration with student information systems
- [ ] Advanced ML models (XGBoost, LightGBM)
- [ ] Model versioning and A/B testing

---

## 📝 License

This project is developed for Uganda Christian University (UCU) as part of a final year project.

---

## 👥 Contributors

This project is proudly developed by the **NextGen Data Architects** team, a group of dedicated students pursuing their Bachelor of Science in Data Science and Analytics at Uganda Christian University.

### Core Development Team

- **Guloba Emmanuel Edube** - [@Edube20Emmanuel](https://github.com/Edube20Emmanuel)
- **Emmanuel Nsubuga** - [@Cemputus](https://github.com/Cemputus)
- **Asingwiire Enoch** - [@asingwiireenoch](https://github.com/asingwiireenoch)

### Acknowledgments

We extend our sincere gratitude to Uganda Christian University for providing the platform and resources that made this project possible. Special thanks to our academic advisors and the UCU community for their invaluable support throughout the development process.

---

## 📞 Support

For issues or questions:

1. Check the troubleshooting section
2. Review API documentation
3. Check logs for error messages
4. Contact the development team: [ensubuga019@gmail.com](mailto:ensubuga019@gmail.com)

---

**Last Updated**: February 2026

**Version**: 2.0.0

**Changelog (v2.0.0)**: Admin console Refresh and KPI behaviour; Employees/Staff KPI definitions (ETL + app users; demo fallback); full admin export (users, audit logs, ETL, warehouse); HR/Finance faculty/department on create; Recent ETL runs label and 50-run cap.
