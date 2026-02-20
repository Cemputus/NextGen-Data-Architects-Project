# Reset app user password (sysadmin only)

If an app user cannot log in, a sysadmin can reset their password.

1. Log in to the app as **admin** (e.g. username `admin`, password `admin123`).
2. Open the browser **Developer Console** (F12 → Console).
3. Run this (change `username` and `new_password` as needed):

```javascript
fetch('http://127.0.0.1:5000/api/user-mgmt/users/reset-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('token') },
  body: JSON.stringify({ username: 'Cemputus', new_password: 'cen123' })
}).then(r => r.json()).then(console.log);
```

4. If you see `{ message: 'Password reset successfully', username: 'Cemputus' }`, log out and log in as **Cemputus** with password **cen123**.

**Or** use Admin → Users → Edit user → set "New password" → Save.
