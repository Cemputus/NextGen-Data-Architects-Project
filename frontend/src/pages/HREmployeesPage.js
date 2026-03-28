/**
 * HR Employees - List all employees (ETL) and app users.
 */
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { usePersistedState } from '../hooks/usePersistedState';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Users, Search, Loader2 } from 'lucide-react';

const auth = () => ({ headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` } });

export default function HREmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [appUsers, setAppUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = usePersistedState('hr_employees_searchTerm', '');

  useEffect(() => {
    Promise.all([
      axios.get('/api/analytics/hr', auth()).then((r) => r.data?.employees_list || []).catch(() => []),
      axios.get('/api/hr/staff-list', auth()).then((r) => r.data?.staff || []).catch(() => []),
    ]).then(([empList, staffList]) => {
      setEmployees(empList);
      setAppUsers(staffList);
    }).finally(() => setLoading(false));
  }, []);

  const combined = useMemo(() => {
    const fromEmp = (employees || []).map((e) => ({
      id: e.employee_id,
      name: e.full_name,
      role: e.position_title || e.role_group,
      faculty: e.faculty_name,
      department: e.department_name,
      source: 'Employee',
      dateOfBirth: e.date_of_birth,
      age: e.age,
      yearsToRetirement: e.years_to_retirement,
      retirementLabel: e.retirement_label,
      retirementAlert: !!e.retirement_alert,
      retirementProximity: e.retirement_proximity,
    }));
    const fromApp = (appUsers || []).map((u) => ({
      id: u.id || u.username,
      name: u.full_name || u.username,
      role: u.role,
      faculty: u.faculty_name,
      department: u.department_name,
      source: 'App user',
      dateOfBirth: null,
      age: null,
      yearsToRetirement: null,
      retirementLabel: null,
      retirementAlert: false,
      retirementProximity: null,
    }));
    return [...fromEmp, ...fromApp];
  }, [employees, appUsers]);

  const filtered = useMemo(() => {
    const term = (searchTerm || '').toLowerCase();
    if (!term) return combined;
    return combined.filter(
      (p) =>
        (p.name || '').toLowerCase().includes(term) ||
        (p.role || '').toLowerCase().includes(term) ||
        (p.faculty || '').toLowerCase().includes(term) ||
        (p.department || '').toLowerCase().includes(term) ||
        String(p.age ?? '').includes(term) ||
        (p.retirementLabel || '').toLowerCase().includes(term)
    );
  }, [combined, searchTerm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
          <Users className="h-6 w-6 text-muted-foreground" />
          Employees
        </h1>
        <p className="text-sm text-muted-foreground mt-1">All employees and app users. HR-managed.</p>
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base font-semibold">Directory</CardTitle>
          <CardDescription className="text-xs">Employees from ETL and system app users</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, role, faculty, department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[920px] text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/60">
                  <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                    Name
                  </th>
                  <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground min-w-[8rem]">
                    Role / position
                  </th>
                  <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                    Date of birth
                  </th>
                  <th className="text-right px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground w-14">
                    Age
                  </th>
                  <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground min-w-[13rem]">
                    Retirement status
                  </th>
                  <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground min-w-[7rem]">
                    Faculty
                  </th>
                  <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground min-w-[7rem]">
                    Department
                  </th>
                  <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                    Source
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, idx) => (
                  <tr
                    key={`${p.source}-${p.id}`}
                    className={`border-b border-border last:border-0 ${
                      idx % 2 === 0 ? 'bg-background' : 'bg-muted/25'
                    }`}
                  >
                    <td className="px-3 py-2.5 align-top font-medium text-foreground">{p.name || '—'}</td>
                    <td className="px-3 py-2.5 align-top text-muted-foreground">{p.role || '—'}</td>
                    <td className="px-3 py-2.5 align-top whitespace-nowrap tabular-nums">
                      {p.dateOfBirth ? String(p.dateOfBirth).slice(0, 10) : '—'}
                    </td>
                    <td className="px-3 py-2.5 align-top text-right tabular-nums">{p.age != null ? p.age : '—'}</td>
                    <td
                      className={`px-3 py-2.5 align-top leading-snug ${
                        p.retirementAlert
                          ? 'text-red-600 dark:text-red-400 font-semibold'
                          : 'text-foreground'
                      }`}
                    >
                      {p.retirementLabel || '—'}
                    </td>
                    <td className="px-3 py-2.5 align-top">{p.faculty || '—'}</td>
                    <td className="px-3 py-2.5 align-top">{p.department || '—'}</td>
                    <td className="px-3 py-2.5 align-top text-muted-foreground text-xs whitespace-nowrap">
                      {p.source}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">No employees or app users found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
