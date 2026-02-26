/**
 * Staff Dashboard - Smooth, Clean UI
 */
import React, { useState, useEffect } from 'react';
import { GraduationCap, Users, BookOpen, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import GlobalFilterPanel from '../components/GlobalFilterPanel';
import ModernStatsCards from '../components/ModernStatsCards';
import RoleBasedCharts from '../components/RoleBasedCharts';
import RoleDashboardRenderer from '../components/RoleDashboardRenderer';
import ExportButtons from '../components/ExportButtons';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const StaffDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [stats, setStats] = useState(null);
  const [showWelcome, setShowWelcome] = useState(true);

  useEffect(() => {
    loadStaffData();
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), 30000);
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
      const response = await axios.get('/api/analytics/staff/classes', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: filters
      });
      setClasses(response.data.classes || []);
      setStats(response.data.stats || null);
    } catch (err) {
      console.error('Error loading staff data:', err);
    } finally {
      setLoading(false);
    }
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
          {/* Legacy static KPI summary */}
          {stats && <ModernStatsCards stats={stats} type="general" />}

          {/* Dynamic current dashboard for Staff role */}
          <RoleDashboardRenderer stats={stats} type="staff" />
        </>
      )}
    </div>
  );
};

export default StaffDashboard;
