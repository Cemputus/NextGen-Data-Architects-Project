/**
 * HR Evaluation – Evaluate each employee.
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Loader2, ClipboardCheck } from 'lucide-react';

const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export default function HREvaluationPage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get('/api/analytics/hr', auth())
      .then((r) => setEmployees(r.data?.employees_list || []))
      .catch(() => setEmployees([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6 text-muted-foreground" />
          Evaluation
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Evaluate each employee. HR-managed.
        </p>
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base font-semibold">Employee evaluations</CardTitle>
          <CardDescription className="text-xs">Select an employee to add or view evaluation</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : employees.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No employees loaded. Run ETL or check HR analytics.</p>
          ) : (
            <ul className="space-y-2">
              {employees.map((e) => (
                <li key={e.employee_id} className="flex items-center justify-between gap-2 p-3 rounded-lg border bg-muted/10">
                  <span className="font-medium">{e.full_name || '—'}</span>
                  <span className="text-sm text-muted-foreground">{e.position_title || e.role_group}</span>
                  <Button variant="outline" size="sm" disabled>
                    Evaluate (coming soon)
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
