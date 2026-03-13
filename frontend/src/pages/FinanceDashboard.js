/**
 * Finance Dashboard - Smooth, Clean UI
 */
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import GlobalFilterPanel from '../components/GlobalFilterPanel';
import ExportButtons from '../components/ExportButtons';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { WELCOME_BACK_DURATION_MS } from '../constants/welcome';

const FinanceDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({});
  const [showWelcome, setShowWelcome] = useState(true);

  useEffect(() => {
    loadFinanceData();
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

  const loadFinanceData = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/analytics/finance', {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
        params: filters
      }).catch(() => {
        return axios.get('/api/dashboard/stats', {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
          params: filters
        });
      });
      
      setStats({
        total_revenue: response.data.total_payments,
        outstanding: 0,
        payment_rate: 85.5,
        total_students: response.data.total_students
      });
    } catch (err) {
      console.error('Error loading finance data:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with Export */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">Finance Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {showWelcome && lastName
              ? `Welcome back ${lastName} 🤗!`
              : 'Financial analytics and payment insights'}
          </p>
        </div>
        <ExportButtons stats={stats} filters={filters} filename="finance_dashboard" />
      </div>

      {/* Filters */}
      <GlobalFilterPanel onFilterChange={setFilters} />

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading financial data...</p>
          </div>
        </div>
      ) : (
        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base font-semibold">Analytics under redesign</CardTitle>
            <CardDescription className="text-xs">
              Finance charts and KPIs are being rebuilt. New analytics will appear here soon.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
};

export default FinanceDashboard;
