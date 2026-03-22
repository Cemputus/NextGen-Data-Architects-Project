/**
 * Leave Requests – Directory for all employee roles: who's on leave + request log.
 * Approve / reject: HR, sysadmin, and admin only.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Loader2, Calendar, Users, Check, X, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const auth = () => ({ headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` } });

/** Path prefix for User Info (submit leave) for current workspace */
function userInfoPathForRole(role) {
  const r = (role || '').toString().toLowerCase();
  if (r === 'admin' || r === 'sysadmin') return '/admin/user-info';
  if (r === 'hr') return '/hr/user-info';
  if (r === 'student') return '/student/user-info';
  if (r === 'staff') return '/staff/user-info';
  if (r === 'hod') return '/hod/user-info';
  if (r === 'dean') return '/dean/user-info';
  if (r === 'senate') return '/senate/user-info';
  if (r === 'finance') return '/finance/user-info';
  if (r === 'analyst') return '/analyst/user-info';
  return '/user-info';
}

export default function HRLeaveRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [onLeave, setOnLeave] = useState([]);
  const [loading, setLoading] = useState(true);
  const [onLeaveLoading, setOnLeaveLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState(null);
  const [error, setError] = useState('');

  const canReview = useMemo(() => {
    const r = (user?.role || '').toString().toLowerCase();
    return r === 'hr' || r === 'sysadmin' || r === 'admin';
  }, [user?.role]);

  const userInfoHref = useMemo(() => userInfoPathForRole(user?.role), [user?.role]);

  const loadAll = () => {
    setLoading(true);
    setOnLeaveLoading(true);
    setError('');
    Promise.all([
      axios.get('/api/hr/leave-requests', auth()),
      axios.get('/api/hr/employees-on-leave', auth()),
    ])
      .then(([r1, r2]) => {
        setRequests(r1.data?.requests || []);
        setOnLeave(r2.data?.on_leave || []);
      })
      .catch((e) => {
        setRequests([]);
        setOnLeave([]);
        const msg = e.response?.data?.error || e.message || 'Failed to load leave data.';
        if (e.response?.status === 403) {
          setError('You do not have access to the leave directory.');
        } else {
          setError(msg);
        }
      })
      .finally(() => {
        setLoading(false);
        setOnLeaveLoading(false);
      });
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleReview = async (leaveId, action) => {
    setReviewingId(leaveId);
    setError('');
    try {
      await axios.post(`/api/hr/leave-requests/${leaveId}/review`, { action }, auth());
      loadAll();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to update.');
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
          <Calendar className="h-6 w-6 text-muted-foreground" />
          Leave requests
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {canReview
            ? 'Review and approve or reject pending requests. See who is currently on leave below.'
            : 'View who is on leave and all requests. Submit your own leave from User Info — HR or an administrator approves pending items.'}
        </p>
      </div>

      {!canReview && (
        <div className="rounded-lg border border-border/70 bg-muted/40 px-4 py-3 text-sm flex gap-2 items-start">
          <Info className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
          <div>
            <p className="font-medium text-foreground/90">Read-only directory</p>
            <p className="text-muted-foreground text-xs mt-1">
              To apply for leave, go to{' '}
              <Link to={userInfoHref} className="text-primary underline underline-offset-2 font-medium">
                User Info
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card className="border shadow-sm">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Employees on leave today
          </CardTitle>
          <CardDescription className="text-xs">People with approved leave covering today</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {onLeaveLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : onLeave.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3">No one on leave today.</p>
          ) : (
            <ul className="space-y-2">
              {onLeave.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center gap-2 text-sm py-1.5 border-b border-border/50 last:border-0"
                >
                  <span className="font-medium">{e.full_name || e.username}</span>
                  <span className="text-muted-foreground">({e.username})</span>
                  <span className="text-muted-foreground">
                    {e.start_date} – {e.end_date}
                  </span>
                  {e.reason && <span className="text-muted-foreground">· {e.reason}</span>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border shadow-sm">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base font-semibold">All requests</CardTitle>
          <CardDescription className="text-xs">
            Pending and processed leave requests
            {!loading && requests.length === 0 && (
              <span className="block mt-1">
                No leave requests yet. Employees submit from{' '}
                <Link to={userInfoHref} className="text-primary underline underline-offset-2">
                  User Info
                </Link>
                .
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No leave requests yet. Employees submit requests from their{' '}
              <Link to={userInfoHref} className="text-primary underline underline-offset-2">
                User Info
              </Link>{' '}
              page.
            </p>
          ) : (
            <ul className="space-y-3">
              {requests.map((req) => (
                <li
                  key={req.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border bg-muted/20"
                >
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="font-medium">{req.username || '—'}</span>
                    <span className="text-sm text-muted-foreground">
                      {req.start_date} – {req.end_date}
                    </span>
                    <span className="text-sm break-words">{req.reason || '—'}</span>
                    {req.request_type === 'extension' && (
                      <span className="text-xs text-muted-foreground">(extension)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs capitalize font-medium">{req.status || 'pending'}</span>
                    {canReview && (req.status || '').toLowerCase() === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 gap-1"
                          onClick={() => handleReview(req.id, 'approve')}
                          disabled={reviewingId !== null}
                        >
                          {reviewingId === req.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1"
                          onClick={() => handleReview(req.id, 'reject')}
                          disabled={reviewingId !== null}
                        >
                          <X className="h-3 w-3" /> Reject
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
