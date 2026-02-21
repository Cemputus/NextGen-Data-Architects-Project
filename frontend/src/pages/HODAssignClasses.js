/**
 * HOD: Assign classes (courses) to staff in department. Staff only see data for assigned courses.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Loader2, Users, Save } from 'lucide-react';
import axios from 'axios';

const getToken = () => localStorage.getItem('token');

export default function HODAssignClasses() {
  const [staff, setStaff] = useState([]);
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [staffRes, coursesRes] = await Promise.all([
        axios.get('/api/hod/staff-in-department', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/hod/department-courses', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setStaff(staffRes.data.staff || []);
      setCourses(coursesRes.data.courses || []);
      const ids = (staffRes.data.staff || []).map((s) => s.id);
      const next = {};
      await Promise.all(
        ids.map(async (id) => {
          try {
            const r = await axios.get(`/api/hod/staff-assignments/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            next[id] = r.data.course_codes || [];
          } catch {
            next[id] = [];
          }
        })
      );
      setAssignments(next);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load.');
      setStaff([]);
      setCourses([]);
      setAssignments({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAssignmentsChange = (staffId, selectedCodes) => {
    const multi = selectedCodes.target;
    const selected = Array.from(multi.selectedOptions).map((o) => o.value);
    setAssignments((prev) => ({ ...prev, [staffId]: selected }));
  };

  const handleSave = async (staffId) => {
    const token = getToken();
    if (!token) return;
    setSaving(staffId);
    try {
      await axios.put(`/api/hod/staff-assignments/${staffId}`, { course_codes: assignments[staffId] || [] }, { headers: { Authorization: `Bearer ${token}` } });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">Assign classes to staff</h1>
        <p className="text-sm text-muted-foreground">
          Staff can only see data for students in the classes you assign. Select courses per staff and save.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 text-destructive border border-destructive/20 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : staff.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No staff in your department yet. Add staff users (with role Staff and your department) in Admin → Users.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {staff.map((s) => (
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{s.full_name || s.username}</CardTitle>
                <CardDescription>{s.username}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <label className="text-sm font-medium text-foreground">Assigned classes (courses)</label>
                <select
                  multiple
                  className="w-full min-h-[120px] rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  value={assignments[s.id] || []}
                  onChange={(e) => handleAssignmentsChange(s.id, e)}
                >
                  {courses.map((c) => (
                    <option key={c.course_code} value={c.course_code}>
                      {c.course_name || c.course_code}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">Hold Ctrl/Cmd to select multiple.</p>
                <Button size="sm" onClick={() => handleSave(s.id)} disabled={saving === s.id} className="gap-2">
                  {saving === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save assignments
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
