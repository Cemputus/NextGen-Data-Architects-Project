/**
 * Senate Finance Page - Financial analytics for Senate role only
 */
import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, CreditCard, Receipt } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import GlobalFilterPanel from '../components/GlobalFilterPanel';
import RoleBasedCharts from '../components/RoleBasedCharts';
import ModernStatsCards from '../components/ModernStatsCards';
import ExportButtons from '../components/ExportButtons';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { loadPageState, savePageState } from '../utils/statePersistence';

const SenateFinance = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  
  // Load persisted state
  const savedState = loadPageState('senate_finance', { filters: {} });
  const [filters, setFilters] = useState(savedState.filters || {});

  useEffect(() => {
    loadFinanceData();
  }, [filters]);

  // Save state whenever it changes
  useEffect(() => {
    savePageState('senate_finance', { filters });
  }, [filters]);

  const loadFinanceData = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/dashboard/stats', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: filters
      }).catch(() => {
        return axios.get('/api/dashboard/stats', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          params: filters
        });
      });
      
      setStats({
        total_revenue: response.data.total_payments || 0,
        outstanding: 0,
        payment_rate: 85.5,
        total_students: response.data.total_students || 0
      });
    } catch (err) {
      console.error('Error loading finance data:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial Analytics</h1>
          <p className="text-muted-foreground">Institution-wide financial performance and revenue analysis</p>
        </div>
        <ExportButtons 
          stats={stats} 
          filters={filters} 
          filename="senate_finance"
          chartSelectors={[
            '.recharts-wrapper',
            '[class*="chart"]',
            '[data-chart]'
          ]}
        />
      </div>

      {/* Filters */}
      <GlobalFilterPanel onFilterChange={setFilters} pageName="senate_finance" />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-muted-foreground">Loading financial data...</p>
          </div>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <ModernStatsCards stats={stats} type="finance" />

          {/* Financial Charts */}
          <Card>
            <CardHeader>
              <CardTitle>Financial Analytics</CardTitle>
              <CardDescription>Payment trends, revenue flow, and collection efficiency</CardDescription>
            </CardHeader>
            <CardContent data-chart-container="true" data-chart-title="Financial Analytics">
              <RoleBasedCharts filters={filters} type="finance" />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default SenateFinance;




