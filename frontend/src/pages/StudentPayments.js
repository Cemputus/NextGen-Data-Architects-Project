/**
 * Student Payments Page - Independent page for viewing payments
 */
import React, { useState, useEffect } from 'react';
import { DollarSign, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import RoleBasedCharts from '../components/RoleBasedCharts';
import ExportButtons from '../components/ExportButtons';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

const StudentPayments = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [paymentBreakdown, setPaymentBreakdown] = useState(null);

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    try {
      setLoading(true);
      const [statsRes, breakdownRes] = await Promise.all([
        axios.get('/api/analytics/student', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          params: { access_number: user?.access_number || user?.username }
        }).catch(() => ({ data: null })),
        axios.get('/api/dashboard/student-payment-breakdown', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }).catch(() => ({ data: null }))
      ]);
      setStats(statsRes.data);
      setPaymentBreakdown(breakdownRes.data);
    } catch (err) {
      console.error('Error loading payments:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const totalPaid = paymentBreakdown?.total_paid || stats?.total_paid || 0;
  const totalPending = paymentBreakdown?.total_pending || stats?.total_pending || 0;
  const totalRequired = totalPaid + totalPending;
  const paidPercentage = totalRequired > 0 ? (totalPaid / totalRequired * 100).toFixed(1) : 0;
  const pendingPercentage = totalRequired > 0 ? (totalPending / totalRequired * 100).toFixed(1) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Payments</h1>
          <p className="text-muted-foreground">View your fee payments and outstanding balances</p>
        </div>
        <ExportButtons stats={stats} filename="student_payments" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-green-700">
              <CheckCircle className="h-5 w-5" />
              Total Paid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              UGX {(totalPaid / 1000000).toFixed(2)}M
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {paidPercentage}% of total fees
            </p>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-orange-700">
              <AlertCircle className="h-5 w-5" />
              Outstanding Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              UGX {(totalPending / 1000000).toFixed(2)}M
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {pendingPercentage}% remaining
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment Breakdown</CardTitle>
          <CardDescription>Detailed payment status and history</CardDescription>
        </CardHeader>
        <CardContent>
          <RoleBasedCharts filters={{}} type="student" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>Recent payment transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-center py-8 text-muted-foreground">
              Payment history table will be displayed here
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentPayments;






