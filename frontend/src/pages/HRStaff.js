/**
 * HR Staff Page - Staff management
 */
import React, { useState, useEffect, useMemo } from 'react';
import { usePersistedState } from '../hooks/usePersistedState';
import { Users, Plus, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Loader2 } from 'lucide-react';
import axios from 'axios';

const HRStaff = () => {
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState([]);
  const [searchTerm, setSearchTerm] = usePersistedState('hr_staff_searchTerm', '');

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/hr/staff-list', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setStaff(response.data.staff || []);
    } catch (err) {
      console.error('Error loading staff:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredStaff = useMemo(() => {
    const term = (searchTerm || '').toLowerCase();
    if (!term) return staff;
    return staff.filter((s) => {
      const name = (s.full_name || '').toLowerCase();
      const username = (s.username || '').toLowerCase();
      const role = (s.role || '').toLowerCase();
      const faculty = (s.faculty_name || '').toLowerCase();
      const dept = (s.department_name || '').toLowerCase();
      return (
        name.includes(term) ||
        username.includes(term) ||
        role.includes(term) ||
        faculty.includes(term) ||
        dept.includes(term)
      );
    });
  }, [staff, searchTerm]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">Staff Management</h1>
          <p className="text-sm text-muted-foreground">Manage staff members and their information</p>
        </div>
        <Button disabled className="opacity-60 cursor-not-allowed">
          <Plus className="h-4 w-4 mr-2" />
          Add Staff (coming soon)
        </Button>
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base font-semibold">Staff Directory</CardTitle>
          <CardDescription className="text-xs">All staff members in the system</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <Input
              placeholder="Search staff..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Button type="button" onClick={loadStaff} variant="outline">
              <Search className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {filteredStaff.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No staff members found. Try clearing the search or add app users in Admin → Users.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs uppercase text-muted-foreground">
                        <th className="py-2 pr-4 text-left">Name</th>
                        <th className="py-2 px-4 text-left">Username</th>
                        <th className="py-2 px-4 text-left">Role</th>
                        <th className="py-2 px-4 text-left">Faculty</th>
                        <th className="py-2 px-4 text-left">Department</th>
                        <th className="py-2 pl-4 text-left">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStaff.map((s) => (
                        <tr key={s.id || s.username} className="border-b last:border-0 hover:bg-muted/40">
                          <td className="py-2 pr-4">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{s.full_name || s.username}</span>
                            </div>
                          </td>
                          <td className="py-2 px-4 text-muted-foreground">{s.username}</td>
                          <td className="py-2 px-4">{s.role}</td>
                          <td className="py-2 px-4">{s.faculty_name || '—'}</td>
                          <td className="py-2 px-4">{s.department_name || '—'}</td>
                          <td className="py-2 pl-4 text-xs text-muted-foreground">
                            {s.source === 'demo' ? 'Demo' : 'App User'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HRStaff;






