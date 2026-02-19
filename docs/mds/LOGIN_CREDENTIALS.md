# Login Credentials - NextGen Data Architects

## All User Types - Login Credentials

### Staff/Admin Users (Username + Password)

| Role | Username | Password | Dashboard Route |
|------|----------|----------|-----------------|
| System Administrator | `admin` | `admin123` | `/admin/dashboard` |
| Data Analyst | `analyst` | `analyst123` | `/analyst/dashboard` |
| Senate Member | `senate` | `senate123` | `/senate/dashboard` |
| Staff Member | `staff` | `staff123` | `/staff/dashboard` |
| Faculty Dean | `dean` | `dean123` | `/dean/dashboard` |
| Head of Department | `hod` | `hod123` | `/hod/dashboard` |
| HR Manager | `hr` | `hr123` | `/hr/dashboard` |
| Finance Manager | `finance` | `finance123` | `/finance/dashboard` |

### Student Users (Access Number + Password)

**Format:** `AccessNumber@ucu`

**Example:**
- Access Number: `A26143`
- Password: `A26143@ucu`
- Dashboard Route: `/student/dashboard`

**Available Student Access Numbers:**
- `A26143` - Password: `A26143@ucu`
- `A25176` - Password: `A25176@ucu`
- `A75239` - Password: `A75239@ucu`
- `A53078` - Password: `A53078@ucu`
- `A30892` - Password: `A30892@ucu`
- `B64817` - Password: `B64817@ucu`
- `B93958` - Password: `B93958@ucu`
- `A25278` - Password: `A25278@ucu`
- `A87018` - Password: `A87018@ucu`
- `A34331` - Password: `A34331@ucu`

(Any Access Number from the database works with format: `{AccessNumber}@ucu`)

## Login Instructions

1. **For Students:**
   - Enter your Access Number (e.g., `A26143`)
   - Enter password in format: `{AccessNumber}@ucu` (e.g., `A26143@ucu`)

2. **For Staff/Admin:**
   - Enter username (e.g., `admin`, `dean`, `staff`, etc.)
   - Enter corresponding password (e.g., `admin123`, `dean123`, `staff123`, etc.)

## Testing

All logins have been tested and verified:
- ✓ All 8 staff/admin roles login successfully
- ✓ Student Access Number login works
- ✓ Invalid credentials are properly rejected
- ✓ Role-based routing works correctly

## Notes

- All passwords are case-sensitive
- Access Numbers must be in format: `A#####` or `B#####`
- Student passwords must match exactly: `{AccessNumber}@ucu`
- The system automatically routes users to their role-specific dashboard after login


