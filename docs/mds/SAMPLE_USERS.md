# Sample Users and Login Credentials

This document contains all sample user accounts and their login credentials for the UCU Analytics Platform.

## 🔐 Authentication Methods

- **Students**: Login using **Access Number** (format: A##### or B#####) with any password (for demo purposes)
- **Staff/Admin Users**: Login using **username** and **password**

---

## 👥 Administrative Users

### System Administrator
- **Username**: `admin`
- **Password**: `admin123`
- **Role**: `sysadmin`
- **Access**: Full system control (manage users, system variables, ETL jobs, schema migrations)
- **Email**: admin@ucu.ac.ug

### Analyst
- **Username**: `analyst`
- **Password**: `analyst123`
- **Role**: `analyst`
- **Access**: Create/modify analytics, dashboards, datasets, run advanced queries
- **Email**: analyst@ucu.ac.ug

### Senate Member
- **Username**: `senate`
- **Password**: `senate123`
- **Role**: `senate`
- **Access**: View all analytics & reports (read-only)
- **Email**: senate@ucu.ac.ug

---

## 🎓 Student Users

Students can login using their **Access Number** with **any password** (for demo purposes).

### Sample Student Accounts

| Access Number | Registration Number | Name | Password (Any) |
|--------------|---------------------|------|----------------|
| `A27424` | J21B04/002 | Peter Nakiyemba | *any* |
| `A90525` | J21B05/001 | Miriam Nabukeera | *any* |
| `B33426` | J21B04/001 | David Mugerwa | *any* |
| `B64086` | J21B04/003 | Jonathan Ssebowa | *any* |
| `B26529` | J21B05/002 | Esther Mugerwa | *any* |

**Note**: To find more student access numbers, query the `dim_student` table in the data warehouse:
```sql
SELECT access_number, reg_no, first_name, last_name 
FROM dim_student 
LIMIT 20;
```

---

## 👨‍🏫 Staff Users

### Dean
- **Username**: `dean`
- **Password**: `dean123`
- **Role**: `dean`
- **Access**: View all academic & administrative activities in their faculty
- **Email**: dean@ucu.ac.ug

### Head of Department (HOD)
- **Username**: `hod`
- **Password**: `hod123`
- **Role**: `hod`
- **Access**: View all academic & administrative activities in their department
- **Email**: hod@ucu.ac.ug

### Staff Member
- **Username**: `staff`
- **Password**: `staff123`
- **Role**: `staff`
- **Access**: View/edit own profile; view evaluations and analytics for classes they teach
- **Email**: staff@ucu.ac.ug

---

## 💼 Administrative Roles

### HR Manager
- **Username**: `hr`
- **Password**: `hr123`
- **Role**: `hr`
- **Access**: View/edit HR-related analytics, staff lists
- **Email**: hr@ucu.ac.ug

### Finance Manager
- **Username**: `finance`
- **Password**: `finance123`
- **Role**: `finance`
- **Access**: View finance analytics, payments, scholarships
- **Email**: finance@ucu.ac.ug

---

## 📝 Login Instructions

### For Students:
1. Go to the login page
2. Enter your **Access Number** (e.g., `A27424`) in the username/identifier field
3. Enter **any password** (for demo purposes)
4. Click "Login"

### For Staff/Admin:
1. Go to the login page
2. Enter your **username** (e.g., `admin`)
3. Enter your **password** (e.g., `admin123`)
4. Click "Login"

---

## 🔑 Quick Reference

| Role | Username/Identifier | Password | Access Level |
|------|-------------------|----------|--------------|
| System Admin | `admin` | `admin123` | Full Control |
| Analyst | `analyst` | `analyst123` | Analytics Management |
| Senate | `senate` | `senate123` | Read-Only (All Data) |
| Student | `A27424` (or any Access Number) | *any* | Own Data Only |
| Dean | `dean` | `dean123` | Faculty-Level |
| HOD | `hod` | `hod123` | Department-Level |
| Staff | `staff` | `staff123` | Own Classes |
| HR | `hr` | `hr123` | HR Data |
| Finance | `finance` | `finance123` | Finance Data |

---

## ⚠️ Important Notes

1. **Demo Mode**: This system is currently in demo mode. Student authentication accepts any password when logging in with an Access Number.

2. **Production**: In production, all passwords should be properly hashed using bcrypt or similar secure hashing algorithms.

3. **Access Numbers**: Student Access Numbers follow the format:
   - `A#####` (e.g., A27424)
   - `B#####` (e.g., B33426)

4. **Finding More Users**: 
   - **Students**: Query `dim_student` table for access numbers
   - **Staff**: Query `lecturers` or `employees` tables in source databases
   - **Users**: Query `users` table in `UCU_DataWarehouse` database

5. **Password Reset**: Contact system administrator for password resets in production.

---

## 🔍 Database Queries

### Get All Students with Access Numbers:
```sql
SELECT access_number, reg_no, first_name, last_name 
FROM UCU_DataWarehouse.dim_student 
ORDER BY access_number 
LIMIT 50;
```

### Get All System Users:
```sql
SELECT username, email, full_name, role_name 
FROM UCU_DataWarehouse.users u
JOIN UCU_DataWarehouse.user_roles ur ON u.role_id = ur.role_id
WHERE u.is_active = TRUE;
```

### Get Students by Program:
```sql
SELECT ds.access_number, ds.reg_no, ds.first_name, ds.last_name, dp.program_name
FROM UCU_DataWarehouse.dim_student ds
JOIN UCU_DataWarehouse.dim_program dp ON ds.program_id = dp.program_id
ORDER BY dp.program_name, ds.access_number;
```

---

## 📞 Support

For issues with login or access, contact:
- **System Administrator**: admin@ucu.ac.ug
- **IT Support**: support@ucu.ac.ug

---

**Last Updated**: Generated automatically from system data
**System Version**: NextGen Data Architects Platform v1.0

