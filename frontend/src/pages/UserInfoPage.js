/**
 * User Info – Profile picture, employment status, leave requests, payroll (HR-managed).
 * Available to all authenticated users. Merged with profile picture for all roles including student.
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useProfilePhoto } from '../hooks/useProfilePhoto';
import { usePersistedState } from '../hooks/usePersistedState';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import { Loader2, User, Calendar, DollarSign } from 'lucide-react';

const auth = () => ({ headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` } });

export default function UserInfoPage() {
  const { user } = useAuth();
  const profilePhotoUrl = useProfilePhoto(user?.profile_picture_url);
  const [employment, setEmployment] = useState(null);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [payroll, setPayroll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [leaveSuccess, setLeaveSuccess] = useState('');
  const [leaveError, setLeaveError] = useState('');
  const [leaveForm, setLeaveForm] = usePersistedState('user_info_leaveForm', { start_date: '', end_date: '', reason: '', request_type: 'new', parent_leave_id: null });

  useEffect(() => {
    Promise.all([
      axios.get('/api/hr/my-employment', auth()).then((r) => r.data).catch(() => ({ status: 'Active' })),
      axios.get('/api/hr/my-leave-requests', auth()).then((r) => r.data?.requests || []).catch(() => []),
      axios.get('/api/hr/my-payroll', auth()).then((r) => r.data).catch(() => ({})),
    ]).then(([emp, leave, pay]) => {
      setEmployment(emp);
      setLeaveRequests(leave);
      setPayroll(pay);
    }).finally(() => setLoading(false));
  }, []);

  const handleSubmitLeave = async (e) => {
    e.preventDefault();
    if (!leaveForm.start_date || !leaveForm.end_date || !leaveForm.reason?.trim()) {
      setLeaveError('Please fill start date, end date, and reason.');
      return;
    }
    if (new Date(leaveForm.start_date) > new Date(leaveForm.end_date)) {
      setLeaveError('Start date must be earlier than or equal to end date.');
      return;
    }
    setLeaveSubmitting(true);
    setLeaveError('');
    setLeaveSuccess('');
    const payload = {
        start_date: leaveForm.start_date,
        end_date: leaveForm.end_date,
        reason: leaveForm.reason.trim(),
        ...(leaveForm.request_type === 'extension' && leaveForm.parent_leave_id ? { request_type: 'extension', parent_leave_id: leaveForm.parent_leave_id } : {}),
      };
    try {
      await axios.post('/api/hr/leave-request', payload, {
        ...auth(),
        headers: { ...auth().headers, 'Content-Type': 'application/json' },
      });
      setLeaveSuccess('Leave request submitted. HR will review.');
      setLeaveForm({ start_date: '', end_date: '', reason: '', request_type: 'new', parent_leave_id: null });
      const r = await axios.get('/api/hr/my-leave-requests', auth());
      setLeaveRequests(r.data?.requests || []);
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.msg ||
        err.response?.data?.message ||
        (err.response?.status === 401 ? 'Please sign in again.' : null) ||
        (err.response?.status === 403 ? 'You do not have permission to submit leave.' : null) ||
        err.message ||
        'Failed to submit leave request.';
      setLeaveError(msg);
    } finally {
      setLeaveSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isStudent = (user?.role || '').toString().toLowerCase() === 'student';
  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || 'User';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Avatar className="h-20 w-20 shrink-0">
          {profilePhotoUrl ? (
            <AvatarImage src={profilePhotoUrl} alt="" className="object-cover" />
          ) : (
            <AvatarFallback className="text-lg font-semibold text-muted-foreground">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          )}
        </Avatar>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <User className="h-6 w-6 text-muted-foreground" />
            User Info
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isStudent
              ? 'Your account and academic info.'
              : 'Your employment status, leave requests, and payroll (managed by HR).'}
          </p>
          <p className="text-sm font-medium text-foreground mt-1">{displayName}</p>
          {user?.role && (
            <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
              {user.role}
            </span>
          )}
        </div>
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base font-semibold">Employment status</CardTitle>
          <CardDescription className="text-xs">Current role and assignment</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium">{employment?.status ?? '—'}</dd>
            <dt className="text-muted-foreground">Role</dt>
            <dd className="font-medium capitalize">{employment?.role ?? '—'}</dd>
            {employment?.faculty_name != null && (
              <>
                <dt className="text-muted-foreground">Faculty</dt>
                <dd>{employment.faculty_name || '—'}</dd>
              </>
            )}
            {employment?.department_name != null && (
              <>
                <dt className="text-muted-foreground">Department</dt>
                <dd>{employment.department_name || '—'}</dd>
              </>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card className="border shadow-sm">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Leave requests
          </CardTitle>
          <CardDescription className="text-xs">Apply for leave; HR will review</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-4">
          {leaveRequests.length > 0 && (
            <div className="space-y-2 mb-4">
              <p className="text-xs font-medium text-muted-foreground">Your requests</p>
              <ul className="space-y-2 text-sm">
                {leaveRequests.map((req) => {
                  const today = new Date().toISOString().slice(0, 10);
                  const status = (req.status || 'pending').toLowerCase();
                  const statusLabel = status === 'pending' ? 'Pending' : status === 'approved' ? 'Approved' : 'Rejected';
                  const isActive = status === 'approved' && req.start_date <= today && req.end_date >= today;
                  const isRejected = status === 'rejected';
                  return (
                    <li key={req.id} className="p-2 rounded-lg border bg-muted/20">
                      <span className="font-medium">{req.start_date} – {req.end_date}</span>: {req.reason || '—'}{' '}
                      <span className={status === 'approved' ? 'text-green-600 dark:text-green-400' : status === 'rejected' ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'}>
                        ({statusLabel})
                      </span>
                      {req.request_type === 'extension' && <span className="text-muted-foreground ml-1">(extension)</span>}
                      {isActive && (
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto p-0 ml-2 text-xs"
                          onClick={() => setLeaveForm((f) => ({ ...f, request_type: 'extension', parent_leave_id: req.id, reason: f.reason || 'Extension of current leave' }))}
                        >
                          Request extension
                        </Button>
                      )}
                      {isRejected && (
                        <p className="text-xs text-muted-foreground mt-1">You can apply again below.</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {(() => {
            const hasPending = leaveRequests.some((r) => (r.status || '').toLowerCase() === 'pending');
            return (
              <>
                {hasPending && (
                  <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                    You have a request waiting for approval. The form below is inactive until HR approves or rejects it.
                  </p>
                )}
                <form onSubmit={handleSubmitLeave} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="leave-start-date" className="text-xs font-medium">Start date</label>
                      <Input
                        id="leave-start-date"
                        type="date"
                        value={leaveForm.start_date}
                        onChange={(e) => setLeaveForm((f) => ({ ...f, start_date: e.target.value }))}
                        className="mt-1 h-9"
                        disabled={hasPending}
                      />
                    </div>
                    <div>
                      <label htmlFor="leave-end-date" className="text-xs font-medium">End date</label>
                      <Input
                        id="leave-end-date"
                        type="date"
                        value={leaveForm.end_date}
                        onChange={(e) => setLeaveForm((f) => ({ ...f, end_date: e.target.value }))}
                        className="mt-1 h-9"
                        disabled={hasPending}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="leave-reason" className="text-xs font-medium">Reason</label>
                    <Input
                      id="leave-reason"
                      value={leaveForm.reason}
                      onChange={(e) => setLeaveForm((f) => ({ ...f, reason: e.target.value }))}
                      placeholder="Brief reason for leave"
                      className="mt-1 h-9"
                      disabled={hasPending}
                    />
                  </div>
                  {leaveError && <p className="text-sm text-destructive">{leaveError}</p>}
                  {leaveSuccess && <p className="text-sm text-green-600 dark:text-green-400">{leaveSuccess}</p>}
                  <Button type="submit" disabled={leaveSubmitting || hasPending}>
                    {leaveSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {hasPending ? 'Submit leave request (inactive — pending approval)' : 'Submit leave request'}
                  </Button>
                </form>
              </>
            );
          })()}
        </CardContent>
      </Card>

      <Card className="border shadow-sm">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Payroll
          </CardTitle>
          <CardDescription className="text-xs">Payment status (HR-managed)</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {payroll?.status != null || payroll?.last_payment_date != null ? (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {payroll.status != null && (
                <>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="font-medium">{payroll.status}</dd>
                </>
              )}
              {payroll.last_payment_date != null && (
                <>
                  <dt className="text-muted-foreground">Last payment</dt>
                  <dd>{payroll.last_payment_date}</dd>
                </>
              )}
              {payroll.pending != null && (
                <>
                  <dt className="text-muted-foreground">Pending</dt>
                  <dd>{payroll.pending}</dd>
                </>
              )}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">No payroll record yet. HR manages payments.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
