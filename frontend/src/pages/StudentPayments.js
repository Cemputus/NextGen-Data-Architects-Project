/**
 * Student Payments Page - Independent page for viewing payments
 */
import React, { useState, useEffect } from 'react';
import { DollarSign, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import ExportButtons from '../components/ExportButtons';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { SciBarChart, SciLineChart } from '../components/charts/EChartsComponents';

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
          headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
          params: { access_number: user?.access_number || user?.username }
        }).catch(() => ({ data: null })),
        axios.get('/api/dashboard/student-payment-breakdown', {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` }
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
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-9 w-9 animate-spin text-primary" />
      </div>
    );
  }

  const totalPaid = paymentBreakdown?.total_paid || stats?.total_paid || 0;
  const totalPending = paymentBreakdown?.total_pending || stats?.total_pending || 0;
  const totalRequired = totalPaid + totalPending;
  const paidPercentage = totalRequired > 0 ? (totalPaid / totalRequired * 100).toFixed(1) : 0;
  const pendingPercentage = totalRequired > 0 ? (totalPending / totalRequired * 100).toFixed(1) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">My Payments</h1>
          <p className="text-sm text-muted-foreground">View your fee payments and outstanding balances</p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Summary</p>
              <ul className="text-sm space-y-1">
                <li>Total paid: <span className="font-semibold">UGX {(totalPaid / 1000000).toFixed(2)}M</span></li>
                <li>Outstanding: <span className="font-semibold">UGX {(totalPending / 1000000).toFixed(2)}M</span></li>
                <li>Paid: <span className="font-semibold">{paidPercentage}%</span> of total fees</li>
                <li>Pending: <span className="font-semibold">{pendingPercentage}%</span> remaining</li>
              </ul>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Breakdown by status</p>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: `${Math.min(Number(paidPercentage) || 0, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Paid</span>
                <span>Pending</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tuition by Semester</CardTitle>
          <CardDescription>Your tuition payments across semesters</CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.payments_by_semester?.length ? (
            <div className="min-h-[200px] max-h-[320px] w-full" data-chart-title="Tuition by Semester" data-chart-container="true">
              <SciBarChart
                data={stats.payments_by_semester}
                xDataKey="semester_name"
                yDataKey="total_paid"
                xAxisLabel="Semester"
                yAxisLabel="Total paid (UGX)"
                fillColor="#10B981"
                showLegend={false}
                showGrid={true}
              />
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              No semester payment data available yet.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment Timeline</CardTitle>
          <CardDescription>Tuition payment trends with timestamps</CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.payment_timeline?.length ? (
            <div className="min-h-[200px] max-h-[320px] w-full" data-chart-title="Payment Timeline" data-chart-container="true">
              <SciLineChart
                data={stats.payment_timeline.map((p) => ({
                  ...p,
                  // Normalize timestamp to a readable label
                  timestamp_label: p.payment_timestamp,
                }))}
                xDataKey="timestamp_label"
                yDataKey="amount"
                xAxisLabel="Payment time"
                yAxisLabel="Amount (UGX)"
                strokeColor="#3B82F6"
                strokeWidth={3}
                showLegend={false}
                showGrid={true}
              />
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              No payment timeline data available yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentPayments;






