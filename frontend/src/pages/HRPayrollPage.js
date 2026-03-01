/**
 * HR Payroll – See who has been paid and who is pending.
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Loader2, DollarSign } from 'lucide-react';

const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export default function HRPayrollPage() {
  const [data, setData] = useState({ payroll_by_role: [], total_payroll: 0, paid: [], pending: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get('/api/hr/payroll-overview', auth())
      .then((r) => setData(r.data || {}))
      .catch(() => setData({ payroll_by_role: [], total_payroll: 0, paid: [], pending: [] }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
          <DollarSign className="h-6 w-6 text-muted-foreground" />
          Payroll
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Check who has been paid and who is pending. HR-managed.
        </p>
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base font-semibold">Overview</CardTitle>
          <CardDescription className="text-xs">Payroll by role and payment status</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {data.total_payroll != null && data.total_payroll > 0 && (
                <p className="text-sm font-medium">Total payroll: {Number(data.total_payroll).toLocaleString()}</p>
              )}
              {(data.payroll_by_role || []).length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {data.payroll_by_role.map((row, i) => (
                    <li key={i} className="flex justify-between">
                      <span>{row.role_name || row.role || '—'}</span>
                      <span>{row.total_net_pay != null ? Number(row.total_net_pay).toLocaleString() : '—'}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {(data.paid || []).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Paid</p>
                  <ul className="text-sm">{data.paid.map((p, i) => <li key={i}>{p.name || p.username}</li>)}</ul>
                </div>
              )}
              {(data.pending || []).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Pending</p>
                  <ul className="text-sm">{data.pending.map((p, i) => <li key={i}>{p.name || p.username}</li>)}</ul>
                </div>
              )}
              {(data.payroll_by_role || []).length === 0 && (data.paid || []).length === 0 && (data.pending || []).length === 0 && (
                <p className="text-sm text-muted-foreground">No payroll data yet. Integrate payroll source to see paid vs pending.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
