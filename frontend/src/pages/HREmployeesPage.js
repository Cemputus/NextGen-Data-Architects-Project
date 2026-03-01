/**
 * HR Employees - List all employees (ETL) and app users.
 */
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Users, Search, Loader2 } from 'lucide-react';

const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export default function HREmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [appUsers, setAppUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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
    }));
    const fromApp = (appUsers || []).map((u) => ({
      id: u.id || u.username,
      name: u.full_name || u.username,
      role: u.role,
      faculty: u.faculty_name,
      department: u.department_name,
      source: 'App user',
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
        (p.department || '').toLowerCase().includes(term)
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Name</th>
                  <th className="text-left py-2 font-medium">Role / Position</th>
                  <th className="text-left py-2 font-medium">Faculty</th>
                  <th className="text-left py-2 font-medium">Department</th>
                  <th className="text-left py-2 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={`${p.source}-${p.id}`} className="border-b last:border-0">
                    <td className="py-2">{p.name || '-'}</td>
                    <td className="py-2">{p.role || '-'}</td>
                    <td className="py-2">{p.faculty || '-'}</td>
                    <td className="py-2">{p.department || '-'}</td>
                    <td className="py-2 text-muted-foreground">{p.source}</td>
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
