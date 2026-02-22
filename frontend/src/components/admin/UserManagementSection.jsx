/**
 * Shared User Management section for Admin Users page and Admin Console (dashboard) Users tab.
 * Lists students (dim_student), demo accounts, and app users. Add User creates real users with role scope.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Users, Search, Loader2, RefreshCw, UserCircle, ExternalLink, Plus, X, Eye, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Modal, ModalHeader, ModalBody } from '../ui/modal';
import { TableWrapper, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Select } from '../ui/select';
import { Label } from '../ui/label';
import { LoadingState, EmptyState, ErrorState } from '../ui/state-messages';
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

const USER_LIMIT_OPTIONS = [5, 10, 20, 30, 40, 50, 100, 150, 200, 500, 'all'];

export default function UserManagementSection({
  showHeader = true,
  compact = false,
  showOpenFullPage = false,
  refreshTrigger,
  onUsersChanged,
}) {
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
  const [usersLimit, setUsersLimit] = useState(5);
  const [viewUser, setViewUser] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ full_name: '', role: 'staff', faculty_id: '', department_id: '', password: '' });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [viewError, setViewError] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

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
      const limitVal = usersLimit === 'all' ? 2000 : usersLimit;
      params.set('limit', String(limitVal));
      const res = await axios.get(`/api/user-mgmt/users?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(res.data.users || []);
      setTotal(res.data.total ?? 0);
      setListWarning(res.data.warning || null);
    } catch (err) {
      setListWarning(null);
      if (!err.response) {
        setError(
          <>
            Backend not reachable. Start it first: double-click <code>backend\run_backend.bat</code> and keep that window open until you see &quot;OK: User Management at...&quot;. Then{' '}
            <a href="http://127.0.0.1:5000/api/user-mgmt/ping" target="_blank" rel="noopener noreferrer">open this link</a> — if you see {`{"ok":true}`}, click Refresh here.
          </>
        );
      } else if (err.response.status === 502) {
        setError('Backend not running. Double-click backend\\run_backend.bat, keep the window open, then click Refresh.');
      } else if (err.response.status === 401) {
        setError('Session expired. Please log in again.');
      } else if (err.response.status === 403) {
        setError('You do not have permission to view users.');
      } else if (err.response.status === 404) {
        setError(
          <>User Management API not found (404). Start the backend (<code>backend\run_backend.bat</code>), then <a href="http://127.0.0.1:5000/api/user-mgmt/ping" target="_blank" rel="noopener noreferrer">test ping</a>. If you see {`{"ok":true}`}, click Refresh here.</>
        );
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
  }, [searchTerm, roleFilter, usersLimit]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (typeof refreshTrigger === 'number' && refreshTrigger > 0) {
      loadUsers();
    }
  }, [refreshTrigger]);

  useEffect(() => {
    if (!addModalOpen && !editUser) return;
    const token = getToken();
    if (!token) return;
    const role = addModalOpen ? addForm.role : editForm.role;
    const facultyParams = new URLSearchParams();
    if (role === 'dean') {
      facultyParams.set('for_role', 'dean');
      if (editUser?.faculty_id) facultyParams.set('current_faculty_id', String(editUser.faculty_id));
    }
    const facultyUrl = `/api/user-mgmt/faculties${facultyParams.toString() ? `?${facultyParams.toString()}` : ''}`;
    axios.get(facultyUrl, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setFaculties(r.data.faculties || []))
      .catch(() => setFaculties([]));
    const deptParams = new URLSearchParams();
    if (role === 'hod') {
      deptParams.set('for_role', 'hod');
      if (editUser?.department_id) deptParams.set('current_department_id', String(editUser.department_id));
    }
    const facultyId = addModalOpen ? addForm.faculty_id : editForm.faculty_id;
    if (facultyId) deptParams.set('faculty_id', String(facultyId));
    const deptUrl = `/api/user-mgmt/departments${deptParams.toString() ? `?${deptParams.toString()}` : ''}`;
    axios.get(deptUrl, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setDepartments(r.data.departments || []))
      .catch(() => setDepartments([]));
  }, [addModalOpen, editUser, addForm.role, addForm.faculty_id, editForm.role, editForm.faculty_id]);

  // Refetch departments when faculty filter changes (for HOD/dean/staff/hr/finance)
  useEffect(() => {
    if (!addModalOpen && !editUser) return;
    const token = getToken();
    if (!token) return;
    const facultyId = addModalOpen ? addForm.faculty_id : editForm.faculty_id;
    const role = addModalOpen ? addForm.role : editForm.role;
    const params = new URLSearchParams();
    if (facultyId) params.set('faculty_id', String(facultyId));
    if (role === 'hod') {
      params.set('for_role', 'hod');
      if (editUser?.department_id) params.set('current_department_id', String(editUser.department_id));
    }
    const url = `/api/user-mgmt/departments${params.toString() ? `?${params.toString()}` : ''}`;
    axios.get(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setDepartments(r.data.departments || []))
      .catch(() => setDepartments([]));
  }, [addModalOpen, addForm.role, addForm.faculty_id, editUser, editForm.faculty_id, editForm.role, editUser?.department_id]);

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
    if (addForm.role === 'staff' && addForm.faculty_id && addForm.department_id) {
      payload.faculty_id = parseInt(addForm.faculty_id, 10);
      payload.department_id = parseInt(addForm.department_id, 10);
    }
    if (['hr', 'finance'].includes(addForm.role)) {
      if (addForm.faculty_id) payload.faculty_id = parseInt(addForm.faculty_id, 10);
      if (addForm.department_id) payload.department_id = parseInt(addForm.department_id, 10);
    }
    try {
      await axios.post('/api/user-mgmt/users', payload, { headers: { Authorization: `Bearer ${token}` } });
      setAddModalOpen(false);
      await loadUsers();
      onUsersChanged?.();
    } catch (err) {
      setAddError(err.response?.data?.error || 'Failed to create user.');
    } finally {
      setAddSubmitting(false);
    }
  };

  const openViewUser = async (u) => {
    setViewError(null);
    setViewUser({ id: u.id, type: u.type || 'student' });
    setViewLoading(true);
    const token = getToken();
    if (!token) {
      setViewError('Please log in again.');
      setViewLoading(false);
      return;
    }
    try {
      const type = (u.type || 'student').toLowerCase();
      let id = String(u.id ?? '');
      if (type === 'app_user') {
        const numId = typeof u.id === 'number' ? u.id : parseInt(u.id, 10);
        id = !Number.isNaN(numId) ? String(numId) : (u.username ? String(u.username) : id);
      }
      const url = `/api/user-mgmt/users/${type}/${encodeURIComponent(id)}`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      setViewUser(res.data);
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || (err.request ? 'Backend unreachable. Start backend (run_backend.bat) and try again.' : 'Failed to load user.');
      setViewError(msg);
    } finally {
      setViewLoading(false);
    }
  };

  const openEditUser = (u) => {
    if (u.type !== 'app_user') return;
    setEditUser(u);
    setEditForm({
      full_name: u.full_name || u.first_name || u.username || '',
      role: u.role || 'staff',
      faculty_id: u.faculty_id ?? '',
      department_id: u.department_id ?? '',
      password: '',
    });
    setEditError(null);
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    if (!editUser) return;
    setEditSubmitting(true);
    setEditError(null);
    const token = getToken();
    if (!token) return;
    const payload = {
      full_name: editForm.full_name.trim(),
      role: editForm.role,
    };
    if (editForm.role === 'dean') {
      payload.faculty_id = editForm.faculty_id ? parseInt(editForm.faculty_id, 10) : null;
    } else if (editForm.role === 'staff') {
      payload.faculty_id = editForm.faculty_id ? parseInt(editForm.faculty_id, 10) : null;
    } else {
      payload.faculty_id = null;
    }
    if (editForm.role === 'hod') {
      payload.department_id = editForm.department_id ? parseInt(editForm.department_id, 10) : null;
    } else if (['staff', 'hr', 'finance'].includes(editForm.role)) {
      payload.department_id = editForm.department_id ? parseInt(editForm.department_id, 10) : null;
    } else {
      payload.department_id = null;
    }
    if (editForm.password) payload.password = editForm.password;
    try {
      const appUserId = typeof editUser.id === 'number' ? editUser.id : parseInt(editUser.id, 10);
      if (Number.isNaN(appUserId)) {
        setEditError('Invalid user id.');
        return;
      }
      await axios.patch(`/api/user-mgmt/users/app_user/${appUserId}`, payload, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      setEditUser(null);
      await loadUsers();
      onUsersChanged?.();
    } catch (err) {
      let msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to update user.';
      if (!err.response && err.request) {
        msg = 'Network error: backend unreachable or CORS. Start backend (run_backend.bat), ensure it shows "User Management at /api/user-mgmt/...", then try again.';
      }
      setEditError(msg);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirm || deleteConfirm.type !== 'app_user') return;
    setDeleteError(null);
    setDeleteSubmitting(true);
    const token = getToken();
    if (!token) return;
    try {
      const appUserId = typeof deleteConfirm.id === 'number' ? deleteConfirm.id : parseInt(deleteConfirm.id, 10);
      if (Number.isNaN(appUserId)) {
        setDeleteError('Invalid user id.');
        return;
      }
      await axios.delete(`/api/user-mgmt/users/app_user/${appUserId}`, { headers: { Authorization: `Bearer ${token}` } });
      setDeleteConfirm(null);
      await loadUsers();
      onUsersChanged?.();
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to delete user.';
      setDeleteError(msg);
    } finally {
      setDeleteSubmitting(false);
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

      <Modal open={addModalOpen} onClose={() => !addSubmitting && setAddModalOpen(false)} titleId="add-user-title" maxWidth="max-w-lg">
        <ModalHeader title="Add User" titleId="add-user-title" onClose={() => !addSubmitting && setAddModalOpen(false)} />
        <ModalBody>
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
              {addForm.role === 'staff' && (
                <div>
                  <Label htmlFor="add-faculty-staff">Faculty *</Label>
                  <Select
                    id="add-faculty-staff"
                    value={addForm.faculty_id}
                    onChange={(e) => setAddForm((f) => ({ ...f, faculty_id: e.target.value, department_id: '' }))}
                    required
                    className="mb-2"
                  >
                    <option value="">Select faculty</option>
                    {faculties.map((f) => (
                      <option key={f.faculty_id} value={f.faculty_id}>{f.faculty_name}</option>
                    ))}
                  </Select>
                  <Label htmlFor="add-dept-staff">Department *</Label>
                  <Select
                    id="add-dept-staff"
                    value={addForm.department_id}
                    onChange={(e) => setAddForm((f) => ({ ...f, department_id: e.target.value }))}
                    required
                  >
                    <option value="">Select department</option>
                    {departments.map((d) => (
                      <option key={d.department_id} value={d.department_id}>{d.department_name}</option>
                    ))}
                  </Select>
                </div>
              )}
              {(addForm.role === 'hod' || addForm.role === 'hr' || addForm.role === 'finance') && (
                <div>
                  <Label htmlFor="add-dept">
                    {addForm.role === 'hod' ? 'Department *' : 'Department (optional)'}
                  </Label>
                  {(addForm.role === 'hr' || addForm.role === 'finance') && (
                    <p className="text-xs text-muted-foreground mb-1">Filter by faculty first to narrow departments</p>
                  )}
                  {addForm.role === 'hr' || addForm.role === 'finance' ? (
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
        </ModalBody>
      </Modal>

      {/* View user modal */}
      <Modal open={!!viewUser} onClose={() => { setViewUser(null); setViewError(null); }} titleId="view-user-title" maxWidth="max-w-lg">
        <ModalHeader title="User details" titleId="view-user-title" onClose={() => { setViewUser(null); setViewError(null); }} />
        <ModalBody>
            {viewError && (
              <div className="rounded-lg bg-destructive/10 text-destructive border border-destructive/20 px-3 py-2 text-sm mb-4">{viewError}</div>
            )}
            {viewLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : viewUser && typeof viewUser.full_name === 'string' ? (
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Name</dt>
                  <dd className="font-medium">{viewUser.full_name || '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Username / Access #</dt>
                  <dd>{viewUser.username || viewUser.access_number || '—'}</dd>
                </div>
                {viewUser.reg_number != null && (
                  <div>
                    <dt className="text-muted-foreground">Reg. #</dt>
                    <dd>{viewUser.reg_number}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-muted-foreground">Role</dt>
                  <dd className="capitalize">{viewUser.role || '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Type</dt>
                  <dd>{viewUser.type === 'app_user' ? 'App user' : viewUser.type === 'demo' ? 'Demo' : viewUser.type || '—'}</dd>
                </div>
                {viewUser.faculty_name != null && (
                  <div>
                    <dt className="text-muted-foreground">Faculty</dt>
                    <dd>{viewUser.faculty_name || '—'}</dd>
                  </div>
                )}
                {viewUser.department_name != null && (
                  <div>
                    <dt className="text-muted-foreground">Department</dt>
                    <dd>{viewUser.department_name || '—'}</dd>
                  </div>
                )}
              </dl>
            ) : !viewError ? (
              <p className="text-sm text-muted-foreground">No details available.</p>
            ) : null}
            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={() => { setViewUser(null); setViewError(null); }}>Close</Button>
            </div>
        </ModalBody>
      </Modal>

      {/* Edit user modal (app_user only) */}
      <Modal open={!!editUser} onClose={() => !editSubmitting && setEditUser(null)} titleId="edit-user-title" maxWidth="max-w-lg">
        <ModalHeader title="Edit user" titleId="edit-user-title" onClose={() => !editSubmitting && setEditUser(null)} />
        <ModalBody>
            <p className="text-sm text-muted-foreground mb-4">
              Editing: <strong>{editUser?.username ?? '—'}</strong>
            </p>
            <form onSubmit={handleEditUser} className="space-y-4">
              {editError && (
                <div className="rounded-lg bg-destructive/10 text-destructive border border-destructive/20 px-3 py-2 text-sm">{editError}</div>
              )}
              <div>
                <Label htmlFor="edit-fullname">Full name</Label>
                <Input
                  id="edit-fullname"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                  placeholder="Full name"
                />
              </div>
              <div>
                <Label htmlFor="edit-role">Role</Label>
                <Select
                  id="edit-role"
                  value={editForm.role}
                  onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value, faculty_id: '', department_id: '' }))}
                >
                  {ADD_USER_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </Select>
              </div>
              {editForm.role === 'dean' && (
                <div>
                  <Label htmlFor="edit-faculty">Faculty</Label>
                  <Select
                    id="edit-faculty"
                    value={editForm.faculty_id}
                    onChange={(e) => setEditForm((f) => ({ ...f, faculty_id: e.target.value, department_id: '' }))}
                  >
                    <option value="">Select faculty</option>
                    {faculties.map((f) => (
                      <option key={f.faculty_id} value={f.faculty_id}>{f.faculty_name}</option>
                    ))}
                  </Select>
                </div>
              )}
              {editForm.role === 'staff' && (
                <div>
                  <Label htmlFor="edit-faculty-staff">Faculty *</Label>
                  <Select
                    id="edit-faculty-staff"
                    value={editForm.faculty_id}
                    onChange={(e) => setEditForm((f) => ({ ...f, faculty_id: e.target.value, department_id: '' }))}
                    required
                    className="mb-2"
                  >
                    <option value="">Select faculty</option>
                    {faculties.map((f) => (
                      <option key={f.faculty_id} value={f.faculty_id}>{f.faculty_name}</option>
                    ))}
                  </Select>
                  <Label htmlFor="edit-dept-staff">Department *</Label>
                  <Select
                    id="edit-dept-staff"
                    value={editForm.department_id}
                    onChange={(e) => setEditForm((f) => ({ ...f, department_id: e.target.value }))}
                    required
                  >
                    <option value="">Select department</option>
                    {departments.map((d) => (
                      <option key={d.department_id} value={d.department_id}>{d.department_name}</option>
                    ))}
                  </Select>
                </div>
              )}
              {(editForm.role === 'hod' || editForm.role === 'hr' || editForm.role === 'finance') && (
                <div>
                  <Label htmlFor="edit-dept">
                    {editForm.role === 'hod' ? 'Department' : 'Department (optional)'}
                  </Label>
                  {(editForm.role === 'hr' || editForm.role === 'finance') && (
                    <Select
                      value={editForm.faculty_id}
                      onChange={(e) => setEditForm((f) => ({ ...f, faculty_id: e.target.value, department_id: '' }))}
                      className="mb-2"
                    >
                      <option value="">All faculties</option>
                      {faculties.map((f) => (
                        <option key={f.faculty_id} value={f.faculty_id}>{f.faculty_name}</option>
                      ))}
                    </Select>
                  )}
                  <Select
                    id="edit-dept"
                    value={editForm.department_id}
                    onChange={(e) => setEditForm((f) => ({ ...f, department_id: e.target.value }))}
                    required={editForm.role === 'hod'}
                  >
                    <option value="">Select department</option>
                    {departments.map((d) => (
                      <option key={d.department_id} value={d.department_id}>{d.department_name}</option>
                    ))}
                  </Select>
                </div>
              )}
              <div>
                <Label htmlFor="edit-password">New password (leave blank to keep current)</Label>
                <Input
                  id="edit-password"
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={editSubmitting} className="gap-2">
                  {editSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save changes
                </Button>
                <Button type="button" variant="outline" onClick={() => !editSubmitting && setEditUser(null)}>
                  Cancel
                </Button>
              </div>
            </form>
        </ModalBody>
      </Modal>

      {/* Delete confirmation */}
      <Modal open={!!deleteConfirm} onClose={() => { if (!deleteSubmitting) { setDeleteConfirm(null); setDeleteError(null); } }} titleId="delete-user-title" maxWidth="max-w-sm">
        <ModalHeader title="Delete user" titleId="delete-user-title" onClose={() => { if (!deleteSubmitting) { setDeleteConfirm(null); setDeleteError(null); } }} />
        <ModalBody>
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to delete <strong>{deleteConfirm?.full_name || deleteConfirm?.username}</strong>? This cannot be undone.
            </p>
            {deleteError && (
              <div className="rounded-lg bg-destructive/10 text-destructive border border-destructive/20 px-3 py-2 text-sm mb-4">{deleteError}</div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { if (!deleteSubmitting) { setDeleteConfirm(null); setDeleteError(null); } }} disabled={deleteSubmitting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteUser} disabled={deleteSubmitting} className="gap-2">
                {deleteSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Delete
              </Button>
            </div>
        </ModalBody>
      </Modal>

      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden />
            <Input
              type="search"
              placeholder="Search by name, username, or access number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadUsers()}
              className="pl-10"
              aria-label="Search users by name, username, or access number"
            />
          </div>
          <label className="sr-only" htmlFor="user-role-filter">Filter by role</label>
          <Select
            id="user-role-filter"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full sm:w-40"
            aria-label="Filter by role"
          >
            {ROLES.map((r) => (
              <option key={r.value || 'all'} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-sm shrink-0" htmlFor="users-limit">
            <span className="text-muted-foreground whitespace-nowrap">Show last</span>
            <Select
              id="users-limit"
              value={String(usersLimit)}
              onChange={(e) => {
                const val = e.target.value;
                setUsersLimit(val === 'all' ? 'all' : Number(val));
              }}
              className="w-28"
              aria-label="Number of users to show"
            >
              {USER_LIMIT_OPTIONS.map((n) => (
                <option key={n} value={String(n)}>
                  {n === 'all' ? 'All' : `${n}`}
                </option>
              ))}
            </Select>
          </label>
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
          <LoadingState message="Loading users..." />
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
          <TableWrapper className="border-0 rounded-none">
            <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Username / Access #</TableHead>
                    <TableHead>Reg. #</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="p-8 text-center">
                        <UserCircle className="h-10 w-10 mx-auto mb-2 opacity-50" aria-hidden />
                        <p className="text-sm text-muted-foreground">No users match your filters.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((u) => (
                      <TableRow
                        key={u.type === 'student' ? `student-${u.id}` : u.type === 'demo' ? `demo-${u.id}` : `app-${u.id}`}
                      >
                        <TableCell className="font-medium text-foreground">
                          {u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || '—'}
                        </TableCell>
                        <TableCell>{u.username || u.access_number || '—'}</TableCell>
                        <TableCell>{u.reg_number || '—'}</TableCell>
                        <TableCell>
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
                        </TableCell>
                        <TableCell>
                          {u.type === 'app_user' ? 'App user' : u.type === 'demo' ? 'Demo' : (u.type || '—')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openViewUser(u)}
                              title="View details"
                              aria-label="View details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {u.type === 'app_user' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openEditUser(u)}
                                  title="Edit user"
                                  aria-label="Edit user"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => setDeleteConfirm(u)}
                                  title="Delete user"
                                  aria-label="Delete user"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
            </Table>
          </TableWrapper>
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
