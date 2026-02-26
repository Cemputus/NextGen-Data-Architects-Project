/**
 * Student Dashboard - Smooth, Clean UI
 */
import React, { useState, useEffect } from 'react';
import { Award, BookOpen, Calendar, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { PageHeader } from '../components/ui/page-header';
import ModernStatsCards from '../components/ModernStatsCards';
import RoleBasedCharts from '../components/RoleBasedCharts';
import RoleDashboardRenderer from '../components/RoleDashboardRenderer';
import ExportButtons from '../components/ExportButtons';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

const StudentDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [showWelcome, setShowWelcome] = useState(true);

  useEffect(() => {
    loadStudentData();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), 30000);
    return () => clearTimeout(timer);
  }, []);

  const loadStudentData = async () => {
    try {
      setLoading(true);
      // Try student analytics endpoint first
      let response;
      try {
        response = await axios.get('/api/analytics/student', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          params: { access_number: user?.access_number || user?.username }
        });
        setStats(response.data);
      } catch (err) {
        // Fallback to dashboard stats with student scope
        response = await axios.get('/api/dashboard/stats', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          params: { access_number: user?.access_number || user?.username }
        });
        setStats(response.data);
      }
    } catch (err) {
      console.error('Error loading student data:', err);
      setError(err.response?.data?.error || 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const lastName =
    (user?.last_name && user.last_name.toString().trim()) ||
    (user?.full_name && user.full_name.toString().trim().split(' ').slice(-1)[0]) ||
    user?.username ||
    '';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-9 w-9 animate-spin text-primary" aria-hidden />
          <p className="text-sm text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Error</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="My Academic Dashboard"
        subtitle={
          showWelcome && lastName
            ? `Welcome back ${lastName} 🤗!`
            : 'Your academic performance and progress'
        }
        actions={<ExportButtons stats={stats} filename="student_dashboard" />}
      />

      {/* Legacy static KPIs */}
      <ModernStatsCards stats={stats} type="student" />

      {/* Dynamic current dashboard for Student role */}
      <RoleDashboardRenderer stats={stats} type="student" />
    </div>
  );
};

export default StudentDashboard;
