/**
 * Finance Payments Page - Payment management
 */
import React, { useState, useEffect } from 'react';
import { DollarSign, CreditCard, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import GlobalFilterPanel from '../components/GlobalFilterPanel';
import RoleBasedCharts from '../components/RoleBasedCharts';
import ExportButtons from '../components/ExportButtons';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

const FinancePayments = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({});

  useEffect(() => {
    loadPayments();
  }, [filters]);

  const loadPayments = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/analytics/finance', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: filters
      }).catch(() => {
        return axios.get('/api/dashboard/stats', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          params: filters
        });
      });
      setStats(response.data);
    } catch (err) {
      console.error('Error loading payments:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Management</h1>
          <p className="text-muted-foreground">Manage student payments and financial transactions</p>
        </div>
        <ExportButtons stats={stats} filters={filters} filename="finance_payments" />
      </div>

      <GlobalFilterPanel onFilterChange={setFilters} />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Payment Analytics</CardTitle>
            <CardDescription>Payment status, trends, and collection efficiency</CardDescription>
          </CardHeader>
          <CardContent>
            <RoleBasedCharts filters={filters} type="finance" />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FinancePayments;






