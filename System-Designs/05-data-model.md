# 05 — Data Model

Persisted data is split across **PostgreSQL databases**: a **data warehouse** (`ucu_datawarehouse` by convention) for analytics star schema, and **`ucu_rbac`** for application identity, optional profile metadata, and audit. Connection strings are defined in [`backend/config/connection.py`](../backend/config/connection.py). The runtime also maintains **`dim_app_user`** in the warehouse to align warehouse facts with application users created in `app_users` (see [`backend/app.py`](../backend/app.py) `_sync_dim_app_user`).

---

## 1. Identity and RBAC (runtime)

The live login path uses **`app_users`** (created/altered in code), not only the older normalized schema in [`backend/sql/create_rbac_system.sql`](../backend/sql/create_rbac_system.sql).

```mermaid
erDiagram
    app_users ||--o{ staff_course_assignments : "assigned courses"
    app_users {
        int id PK
        string username UK
        string password_hash
        string role
        string full_name
        int faculty_id FK "nullable"
        int department_id FK "nullable"
        timestamp created_at
        string created_by_username "optional"
    }
    staff_course_assignments {
        int app_user_id PK,FK
        string course_code PK
    }
```

Additional tables ensured at runtime include **`user_profiles`** (extended profile fields) and **`audit_logs`** inserts from auth flows — see [`backend/api/auth.py`](../backend/api/auth.py).

*Reference schema:* [`create_rbac_system.sql`](../backend/sql/create_rbac_system.sql) defines **`roles`**, **`permissions`**, **`role_permissions`**, **`users`**, **`user_sessions`**, **`audit_logs`**, and **`filter_presets`**. Those tables support a normalized RBAC design; the Flask app primarily enforces access via **JWT claims** and the Python matrix in [`backend/rbac.py`](../backend/rbac.py). *If both exist in an environment, treat `app_users` as the source for app-user login unless migrated otherwise.*

---

## 2. Data warehouse (star schema)

Defined in [`backend/sql/create_data_warehouse.sql`](../backend/sql/create_data_warehouse.sql). Dimensions describe **who** (student, program, department, faculty), **what** (course), and **when** (time, semester); facts capture **enrollment**, **attendance**, **payments**, and **grades**.

```mermaid
erDiagram
    dim_faculty ||--o{ dim_department : "has"
    dim_department ||--o{ dim_program : "offers"
    dim_student ||--o{ fact_enrollment : "enrolled"
    dim_course ||--o{ fact_enrollment : "for"
    dim_time ||--o{ fact_enrollment : "on"
    dim_semester ||--o{ fact_enrollment : "in"
    dim_student ||--o{ fact_attendance : "attends"
    dim_course ||--o{ fact_attendance : "for"
    dim_time ||--o{ fact_attendance : "on"
    dim_student ||--o{ fact_payment : "pays"
    dim_time ||--o{ fact_payment : "on"
    dim_semester ||--o{ fact_payment : "in"
    dim_student ||--o{ fact_grade : "receives"
    dim_course ||--o{ fact_grade : "for"
    dim_time ||--o{ fact_grade : "on"
    dim_semester ||--o{ fact_grade : "in"

    dim_faculty {
        int faculty_id PK
        string faculty_name
        string dean_name
    }
    dim_department {
        int department_id PK
        string department_name
        int faculty_id FK
        string head_of_department
    }
    dim_program {
        int program_id PK
        string program_name
        int department_id FK
    }
    dim_student {
        string student_id PK
        string access_number UK
        int program_id FK
    }
    dim_course {
        string course_code PK
        string department
    }
    dim_time {
        string date_key PK
        date date
    }
    dim_semester {
        int semester_id PK
        string academic_year
    }
    fact_enrollment {
        string enrollment_id PK
        string student_id FK
        string course_code FK
        string date_key FK
        int semester_id FK
    }
    fact_attendance {
        int attendance_id PK
        string student_id FK
        string course_code FK
        string date_key FK
    }
    fact_payment {
        string payment_id PK
        string student_id FK
        string date_key FK
        int semester_id FK
        decimal amount
    }
    fact_grade {
        string grade_id PK
        string student_id FK
        string course_code FK
        string date_key FK
        int semester_id FK
        decimal grade_points
        boolean fcw
    }
```

**Warehouse bridge:** **`dim_app_user`** mirrors application users for analytics that join operational identity to facts (created in [`backend/app.py`](../backend/app.py)).

---

## Related documents

- [Data flow](./04-data-flow-diagrams.md)
- [RBAC and security](./06-rbac-security.md)
