/**
 * Staff Dashboard - Smooth, Clean UI
 */
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import GlobalFilterPanel from '../components/GlobalFilterPanel';
import ExportButtons from '../components/ExportButtons';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { WELCOME_BACK_DURATION_MS } from '../constants/welcome';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { SciBarChart } from '../components/charts/EChartsComponents';
import RoleDashboardRenderer from '../components/RoleDashboardRenderer';
import { useCurrentDashboard } from '../hooks/useCurrentDashboard';
import { getRoleBasedChartsType } from '../utils/roleDashboardChartType';

const StaffDashboard = () => {
  const { user } = useAuth();
  const {
    loading: currentDashLoading,
    dashboard: currentDash,
    error: currentDashError,
    userMessage: currentDashMessage,
  } = useCurrentDashboard();
  const useAssignedDashboardLayout = !currentDashLoading && !currentDashError;
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [filters, setFilters] = useState({});
  const debouncedFilters = useDebouncedValue(filters, 300);
  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    loadStaffData();
  }, [debouncedFilters]);

  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), WELCOME_BACK_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  const lastName =
    (user?.last_name && user.last_name.toString().trim()) ||
    (user?.full_name && user.full_name.toString().trim().split(' ').slice(-1)[0]) ||
    user?.username ||
    '';

  const loadStaffData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const response = await axios.get('/api/analytics/staff/classes', {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
        params: debouncedFilters,
        timeout: 12000,
      });
      setClasses(response.data.classes || []);
      setStats(response.data.stats || null);
      setCharts(response.data.charts || null);
    } catch (err) {
      console.error('Error loading staff data:', err);
      setLoadError(
        err?.response?.data?.error ||
          err?.response?.data?.detail ||
          err?.message ||
          'Could not load staff dashboard data.'
      );
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (value) => {
    if (value === null || value === undefined) return '–';
    if (typeof value === 'number' && value % 1 !== 0) return value.toFixed(1);
    return value.toLocaleString ? value.toLocaleString(undefined) : String(value);
  };

  return (
    <div className="space-y-4">
      {/* Header with Export */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">Staff Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {showWelcome && lastName
              ? `Welcome back ${lastName} 🤗!`
              : 'Class management and teaching analytics'}
          </p>
        </div>
        <ExportButtons stats={stats} filters={filters} filename="staff_dashboard" />
      </div>

      {/* Filters */}
      <GlobalFilterPanel onFilterChange={setFilters} />

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading staff data...</p>
          </div>
        </div>
      ) : (
        <>
          {loadError ? (
            <div className="border border-red-200 bg-red-50 text-red-900 rounded-md px-3 py-2 text-sm">
              {loadError}
            </div>
          ) : null}
          {stats?.scope_missing ? (
            <div className="border border-amber-200 bg-amber-50 text-amber-900 rounded-md px-3 py-2 text-sm">
              {stats?.scope_error || 'Teaching scope is not configured for this staff user.'}
            </div>
          ) : null}

          {currentDashLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading dashboard layout…</p>
            </div>
          ) : useAssignedDashboardLayout ? (
            <RoleDashboardRenderer
              stats={stats}
              type={getRoleBasedChartsType(user?.role)}
              filters={debouncedFilters}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-amber-200/80 bg-amber-50/40 dark:bg-amber-950/20 px-4 py-3 text-sm text-foreground/90">
              {currentDashError
                ? 'Could not load your assigned dashboard. Try refreshing the page.'
                : currentDashMessage || 'No dashboard is assigned for your role yet.'}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StaffDashboard;
