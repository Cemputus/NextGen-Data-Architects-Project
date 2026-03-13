/**
 * Senate Dashboard - Smooth, Clean UI
 */
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import GlobalFilterPanel from '../components/GlobalFilterPanel';
import ExportButtons from '../components/ExportButtons';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { WELCOME_BACK_DURATION_MS } from '../constants/welcome';

const SenateDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [filters, setFilters] = useState({});

  useEffect(() => {
    loadDashboardData();
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

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/dashboard/stats', {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
        params: filters
      });
      setStats(response.data);
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async (format) => {
    try {
      const response = await axios.get(`/api/analytics/export/${format}`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
        params: filters,
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `senate-report.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Error exporting report:', err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">Senate Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {showWelcome && lastName
              ? `Welcome back ${lastName} 🤗!`
              : 'Institution-wide analytics and comprehensive reporting'}
          </p>
        </div>
        <ExportButtons
          stats={stats}
          filters={filters}
          filename="senate_dashboard"
          chartSelectors={[
            '.recharts-wrapper', // All recharts components
            '[class*="chart"]',
            '[data-chart]',
            '[data-chart-container]',
            '.h-\\[350px\\]', // Chart containers with specific heights
            '.h-\\[300px\\]'
          ]}
        />
      </div>

      {/* Filters */}
      <GlobalFilterPanel onFilterChange={setFilters} pageName="senate_dashboard" />

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading institution data...</p>
          </div>
        </div>
      ) : (
        <>
          <Card className="border border-dashed bg-muted/20">
            <CardHeader>
              <CardTitle className="text-sm">Analytics under redesign</CardTitle>
              <CardDescription className="text-xs">
                Charts and KPIs are being rebuilt to focus on current and previous semester. New institution dashboards coming soon.
              </CardDescription>
            </CardHeader>
          </Card>
        </>
      )}
    </div>
  );
};

export default SenateDashboard;
