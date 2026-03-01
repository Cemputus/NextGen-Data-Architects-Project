/**
 * Dean Dashboard - Smooth, Clean UI
 */
import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, GraduationCap, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import GlobalFilterPanel from '../components/GlobalFilterPanel';
import ModernStatsCards from '../components/ModernStatsCards';
import RoleBasedCharts from '../components/RoleBasedCharts';
import RoleDashboardRenderer from '../components/RoleDashboardRenderer';
import ExportButtons from '../components/ExportButtons';
import { SciBarChart } from '../components/charts/EChartsComponents';
import { TableWrapper, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { WELCOME_BACK_DURATION_MS } from '../constants/welcome';

const DeanDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({});
  const [showWelcome, setShowWelcome] = useState(true);
  const [staffViewMode, setStaffViewMode] = useState('auto'); // 'auto' | 'custom'
  const [staffSections, setStaffSections] = useState({
    overview: true,
    byDepartment: true,
    list: true,
  });

  useEffect(() => {
    loadFacultyData();
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), WELCOME_BACK_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  const lastName =
    (user?.last_name && user.last_name.toString().trim()) ||
    (user?.full_name && user.full_name.toString().trim().split(' ').slice(-1)[0]) ||
    user?.username ||
    '';

  const loadFacultyData = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/analytics/faculty', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: filters
      });
      setStats(response.data);
    } catch (err) {
      console.error('Error loading faculty data:', err);
    } finally {
      setLoading(false);
    }
  };

  const staffHasData = stats && typeof stats.total_staff === 'number' && stats.total_staff > 0;
  const staffByDept = Array.isArray(stats?.staff_by_department) ? stats.staff_by_department : [];
  const staffList = Array.isArray(stats?.staff_list) ? stats.staff_list : [];
  const staffHasByDept = staffByDept.length > 0;
  const staffHasList = staffList.length > 0;

  const autoStaffSections = {
    overview: staffHasData,
    byDepartment: staffHasByDept,
    list: staffHasList,
  };

  const activeStaffSections =
    staffViewMode === 'auto' ? autoStaffSections : staffSections;

  return (
    <div className="space-y-4">
      {/* Header with Export */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">Faculty Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {showWelcome && lastName
              ? `Welcome back ${lastName} 🤗!`
              : 'Faculty-wide analytics and insights'}
          </p>
        </div>
        <ExportButtons stats={stats} filters={filters} filename="faculty_dashboard" />
      </div>

      {/* Filters */}
      <GlobalFilterPanel onFilterChange={setFilters} pageName="dean_dashboard" hideFaculty />

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading faculty data...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Legacy static KPIs (optional) */}
          <ModernStatsCards stats={stats} type="faculty" />

          {/* Dynamic current dashboard for Dean role */}
          <RoleDashboardRenderer stats={stats} type="dean" />
        </>
      )}
    </div>
  );
};

export default DeanDashboard;
