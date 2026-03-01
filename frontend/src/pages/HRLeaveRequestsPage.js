/**
 * HR Leave Requests – View and manage leave requests from employees.
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Loader2, Calendar } from 'lucide-react';

const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export default function HRLeaveRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get('/api/hr/leave-requests', auth())
      .then((r) => setRequests(r.data?.requests || []))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
          <Calendar className="h-6 w-6 text-muted-foreground" />
          Leave requests
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and approve or reject leave requests from employees.
        </p>
      </div>

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
              {requests.map((req, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border bg-muted/20">
                  <span className="font-medium">{req.employee_name || req.username || '—'}</span>
                  <span className="text-sm text-muted-foreground">{req.start_date} – {req.end_date}</span>
                  <span className="text-sm">{req.reason || '—'}</span>
                  <span className="text-xs capitalize">{req.status || 'Pending'}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
