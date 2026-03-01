/**
 * HR Leave Requests – View and manage leave requests; see employees currently on leave.
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Loader2, Calendar, Users, Check, X } from 'lucide-react';

const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export default function HRLeaveRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [onLeave, setOnLeave] = useState([]);
  const [loading, setLoading] = useState(true);
  const [onLeaveLoading, setOnLeaveLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState(null);
  const [error, setError] = useState('');

  const loadRequests = () => {
    axios.get('/api/hr/leave-requests', auth())
      .then((r) => setRequests(r.data?.requests || []))
      .catch(() => setRequests([]));
  };

  const loadOnLeave = () => {
    setOnLeaveLoading(true);
    axios.get('/api/hr/employees-on-leave', auth())
      .then((r) => setOnLeave(r.data?.on_leave || []))
      .catch(() => setOnLeave([]))
      .finally(() => setOnLeaveLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    loadRequests();
    loadOnLeave();
    setLoading(false);
  }, []);

  const handleReview = async (leaveId, action) => {
    setReviewingId(leaveId);
    setError('');
    try {
      await axios.post(`/api/hr/leave-requests/${leaveId}/review`, { action }, auth());
      loadRequests();
      loadOnLeave();
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
          Review and approve or reject leave requests. See who is currently on leave below.
        </p>
      </div>

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
          <CardDescription className="text-xs">Staff with approved leave covering today</CardDescription>
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
                <li key={e.id} className="flex flex-wrap items-center gap-2 text-sm py-1.5 border-b border-border/50 last:border-0">
                  <span className="font-medium">{e.full_name || e.username}</span>
                  <span className="text-muted-foreground">({e.username})</span>
                  <span className="text-muted-foreground">{e.start_date} – {e.end_date}</span>
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
          <CardDescription className="text-xs">Pending and processed leave requests</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No leave requests yet. Employees submit requests from their User Info page.
            </p>
          ) : (
            <ul className="space-y-3">
              {requests.map((req) => (
                <li key={req.id} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border bg-muted/20">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{req.username || '—'}</span>
                    <span className="text-sm text-muted-foreground">{req.start_date} – {req.end_date}</span>
                    <span className="text-sm">{req.reason || '—'}</span>
                    {req.request_type === 'extension' && <span className="text-xs text-muted-foreground">(extension)</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs capitalize font-medium">{req.status || 'pending'}</span>
                    {(req.status || '').toLowerCase() === 'pending' && (
                      <>
                        <Button size="sm" variant="default" className="h-7 gap-1" onClick={() => handleReview(req.id, 'approve')} disabled={reviewingId !== null}>
                          {reviewingId === req.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => handleReview(req.id, 'reject')} disabled={reviewingId !== null}>
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
