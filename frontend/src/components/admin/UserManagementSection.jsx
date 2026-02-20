/**
 * Shared User Management section for Admin Users page and Admin Console (dashboard) Users tab.
 * Lists students (dim_student), demo accounts, and app users. Add User creates real users with role scope.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Users, Search, Loader2, RefreshCw, UserCircle, ExternalLink, Plus, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Select } from '../ui/select';
import { Label } from '../ui/label';
import axios from 'axios';
import { cn } from '../../lib/utils';

const getToken = () => localStorage.getItem('token');

const ROLES = [
  { value: '', label: 'All roles' },
  { value: 'student', label: 'Student' },
  { value: 'staff', label: 'Staff' },
  { value: 'sysadmin', label: 'Sysadmin' },
  { value: 'analyst', label: 'Analyst' },
  { value: 'senate', label: 'Senate' },
  { value: 'dean', label: 'Dean' },
  { value: 'hod', label: 'HOD' },
  { value: 'hr', label: 'HR' },
  { value: 'finance', label: 'Finance' },
];

const ADD_USER_ROLES = [
  { value: 'sysadmin', label: 'Admin (Sysadmin)' },
  { value: 'analyst', label: 'Analyst' },
  { value: 'dean', label: 'Dean (assign to a faculty)' },
  { value: 'hod', label: 'HOD (assign to a department)' },
  { value: 'staff', label: 'Staff' },
  { value: 'hr', label: 'HR' },
  { value: 'finance', label: 'Finance' },
];

export default function UserManagementSection({ showHeader = true, compact = false, showOpenFullPage = false }) {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [faculties, setFaculties] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [addForm, setAddForm] = useState({
    username: '',
    password: '',
    full_name: '',
    role: 'staff',
    faculty_id: '',
    department_id: '',
  });
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState(null);
  const [listWarning, setListWarning] = useState(null);

  const loadUsers = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setError('Please log in again.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      if (roleFilter) params.set('role', roleFilter);
      params.set('limit', '500');
      const res = await axios.get(`/api/sysadmin/users?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(res.data.users || []);
      setTotal(res.data.total ?? 0);
      setListWarning(res.data.warning || null);
    } catch (err) {
      setListWarning(null);
      if (!err.response) {
        setError('Backend not reachable. 1) Start backend: double-click backend\\run_backend.bat  2) Restart frontend (npm start). 3) If you have frontend\\.env with REACT_APP_API_URL, remove that line so the proxy is used.');
      } else if (err.response.status === 401) {
        setError('Session expired. Please log in again.');
      } else if (err.response.status === 403) {
        setError('You do not have permission to view users.');
      } else if (err.response.status === 404) {
        setError('User Management API not found. Run backend\\run_backend.bat (or backend/run_backend.sh), then click Refresh.');
      } else if (err.response.status === 503) {
        setError(err.response?.data?.error || 'Admin module unavailable. Restart the backend and check server logs.');
      } else {
        setError(err.response?.data?.error || `Failed to load users (${err.response?.status || 'error'}).`);
      }
      setUsers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, roleFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (!addModalOpen) return;
    const token = getToken();
    if (!token) return;
    axios.get('/api/sysadmin/faculties', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setFaculties(r.data.faculties || []))
      .catch(() => setFaculties([]));
    axios.get('/api/sysadmin/departments', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setDepartments(r.data.departments || []))
      .catch(() => setDepartments([]));
  }, [addModalOpen]);

  // Refetch departments when faculty filter changes (for HOD/dean/staff/hr/finance)
  useEffect(() => {
    if (!addModalOpen) return;
    const token = getToken();
    if (!token) return;
    const url = addForm.faculty_id
      ? `/api/sysadmin/departments?faculty_id=${addForm.faculty_id}`
      : '/api/sysadmin/departments';
    axios.get(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setDepartments(r.data.departments || []))
      .catch(() => setDepartments([]));
  }, [addModalOpen, addForm.role, addForm.faculty_id]);

  const openAddModal = () => {
    setAddForm({ username: '', password: '', full_name: '', role: 'staff', faculty_id: '', department_id: '' });
    setAddError(null);
    setAddModalOpen(true);
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setAddSubmitting(true);
    setAddError(null);
    const token = getToken();
    if (!token) return;
    const payload = {
      username: addForm.username.trim(),
      password: addForm.password,
      full_name: addForm.full_name.trim() || addForm.username.trim(),
      role: addForm.role,
    };
    if (addForm.role === 'dean' && addForm.faculty_id) payload.faculty_id = parseInt(addForm.faculty_id, 10);
    if (addForm.role === 'hod' && addForm.department_id) payload.department_id = parseInt(addForm.department_id, 10);
    if (['staff', 'hr', 'finance'].includes(addForm.role) && addForm.department_id) payload.department_id = parseInt(addForm.department_id, 10);
    try {
      await axios.post('/api/sysadmin/users', payload, { headers: { Authorization: `Bearer ${token}` } });
      setAddModalOpen(false);
      loadUsers();
    } catch (err) {
      setAddError(err.response?.data?.error || 'Failed to create user.');
    } finally {
      setAddSubmitting(false);
    }
  };

  return (
    <Card className={compact ? '' : 'overflow-hidden'}>
      {showHeader && (
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl">User Management</CardTitle>
            <CardDescription>System users (students and staff) and their roles</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={openAddModal} className="gap-2">
              <Plus className="h-4 w-4" />
              Add User
            </Button>
            {showOpenFullPage && (
              <Link
                to="/admin/users"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Open User Management
              </Link>
            )}
            <Button variant="outline" size="sm" onClick={loadUsers} disabled={loading} className="gap-2">
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </CardHeader>
      )}

      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !addSubmitting && setAddModalOpen(false)}>
          <div className="bg-card rounded-xl shadow-xl max-w-md w-full p-6 border border-border" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Add User</h3>
              <Button variant="ghost" size="icon" onClick={() => !addSubmitting && setAddModalOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Create a real user. Deans are scoped to a faculty; HODs to a department. Students sign in with Access Number (no add here).
            </p>
            <form onSubmit={handleAddUser} className="space-y-4">
              {addError && (
                <div className="rounded-lg bg-destructive/10 text-destructive border border-destructive/20 px-3 py-2 text-sm">{addError}</div>
              )}
              <div>
                <Label htmlFor="add-username">Username *</Label>
                <Input
                  id="add-username"
                  value={addForm.username}
                  onChange={(e) => setAddForm((f) => ({ ...f, username: e.target.value }))}
                  placeholder="e.g. j.doe"
                  required
                  autoComplete="username"
                />
              </div>
              <div>
                <Label htmlFor="add-password">Password * (min 6 characters)</Label>
                <Input
                  id="add-password"
                  type="password"
                  value={addForm.password}
                  onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <Label htmlFor="add-fullname">Full name</Label>
                <Input
                  id="add-fullname"
                  value={addForm.full_name}
                  onChange={(e) => setAddForm((f) => ({ ...f, full_name: e.target.value }))}
                  placeholder="e.g. Jane Doe"
                />
              </div>
              <div>
                <Label htmlFor="add-role">Role *</Label>
                <Select
                  id="add-role"
                  value={addForm.role}
                  onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value, faculty_id: '', department_id: '' }))}
                >
                  {ADD_USER_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </Select>
              </div>
              {addForm.role === 'dean' && (
                <div>
                  <Label htmlFor="add-faculty">Faculty *</Label>
                  <Select
                    id="add-faculty"
                    value={addForm.faculty_id}
                    onChange={(e) => setAddForm((f) => ({ ...f, faculty_id: e.target.value, department_id: '' }))}
                    required
                  >
                    <option value="">Select faculty</option>
                    {faculties.map((f) => (
                      <option key={f.faculty_id} value={f.faculty_id}>{f.faculty_name}</option>
                    ))}
                  </Select>
                </div>
              )}
              {(addForm.role === 'hod' || addForm.role === 'staff' || addForm.role === 'hr' || addForm.role === 'finance') && (
                <div>
                  <Label htmlFor="add-dept">
                    {addForm.role === 'hod' ? 'Department *' : 'Department (optional)'}
                  </Label>
                  {(addForm.role === 'staff' || addForm.role === 'hr' || addForm.role === 'finance') && (
                    <p className="text-xs text-muted-foreground mb-1">Filter by faculty first to narrow departments</p>
                  )}
                  {addForm.role === 'staff' || addForm.role === 'hr' || addForm.role === 'finance' ? (
                    <>
                      <Select
                        value={addForm.faculty_id}
                        onChange={(e) => setAddForm((f) => ({ ...f, faculty_id: e.target.value, department_id: '' }))}
                        className="mb-2"
                      >
                        <option value="">All faculties</option>
                        {faculties.map((f) => (
                          <option key={f.faculty_id} value={f.faculty_id}>{f.faculty_name}</option>
                        ))}
                      </Select>
                      <Select
                        id="add-dept"
                        value={addForm.department_id}
                        onChange={(e) => setAddForm((f) => ({ ...f, department_id: e.target.value }))}
                      >
                        <option value="">Select department (optional)</option>
                        {departments.map((d) => (
                          <option key={d.department_id} value={d.department_id}>{d.department_name}</option>
                        ))}
                      </Select>
                    </>
                  ) : (
                    <Select
                      id="add-dept"
                      value={addForm.department_id}
                      onChange={(e) => setAddForm((f) => ({ ...f, department_id: e.target.value }))}
                      required
                    >
                      <option value="">Select department</option>
                      {departments.map((d) => (
                        <option key={d.department_id} value={d.department_id}>{d.department_name}</option>
                      ))}
                    </Select>
                  )}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={addSubmitting} className="gap-2">
                  {addSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create User
                </Button>
                <Button type="button" variant="outline" onClick={() => !addSubmitting && setAddModalOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, username, or access number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadUsers()}
              className="pl-10"
            />
          </div>
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full sm:w-40"
          >
            {ROLES.map((r) => (
              <option key={r.value || 'all'} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
          <Button onClick={loadUsers} disabled={loading} className="gap-2">
            <Search className="h-4 w-4" />
            Search
          </Button>
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 text-destructive border border-destructive/20 px-4 py-3 text-sm">
            {error}
          </div>
        )}
        {listWarning && !error && (
          <div className="rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-4 py-3 text-sm">
            {listWarning}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-3" />
            <p>Loading users...</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left font-semibold p-3">Name</th>
                    <th className="text-left font-semibold p-3">Username / Access #</th>
                    <th className="text-left font-semibold p-3">Reg. #</th>
                    <th className="text-left font-semibold p-3">Role</th>
                    <th className="text-left font-semibold p-3">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        <UserCircle className="h-10 w-10 mx-auto mb-2 opacity-50" />
                        <p>No users match your filters.</p>
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr
                        key={u.id}
                        className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                      >
                        <td className="p-3 font-medium text-foreground">
                          {u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || '—'}
                        </td>
                        <td className="p-3 text-muted-foreground">{u.username || u.access_number || '—'}</td>
                        <td className="p-3 text-muted-foreground">{u.reg_number || '—'}</td>
                        <td className="p-3">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
                              u.role === 'sysadmin' && 'bg-primary/20 text-primary',
                              u.role === 'student' && 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
                              !['sysadmin', 'student'].includes(u.role) && 'bg-muted text-muted-foreground'
                            )}
                          >
                            {u.role || '—'}
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {u.type === 'app_user' ? 'App user' : u.type === 'demo' ? 'Demo' : (u.type || '—')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {users.length > 0 && (
              <div className="px-3 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground">
                Showing {users.length} user{users.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
