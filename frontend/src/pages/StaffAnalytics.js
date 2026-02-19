/**
 * Staff Analytics Page - Independent page for teaching analytics
 */
import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import GlobalFilterPanel from '../components/GlobalFilterPanel';
import RoleBasedCharts from '../components/RoleBasedCharts';
import ExportButtons from '../components/ExportButtons';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

const StaffAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({});

  useEffect(() => {
    loadAnalytics();
  }, [filters]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/dashboard/stats', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: filters
      });
      setStats(response.data);
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teaching Analytics</h1>
          <p className="text-muted-foreground">Performance metrics and class statistics</p>
        </div>
        <ExportButtons stats={stats} filters={filters} filename="staff_analytics" />
      </div>

      <GlobalFilterPanel onFilterChange={setFilters} />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Class Performance Analytics</CardTitle>
            <CardDescription>Analytics for your assigned classes</CardDescription>
          </CardHeader>
          <CardContent>
            <RoleBasedCharts filters={filters} type="staff" />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StaffAnalytics;






