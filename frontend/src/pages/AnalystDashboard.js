/**
 * Analyst Dashboard - Live KPIs + Analytics Workspace
 *
 * This page now focuses only on:
 * - Minimal analyst landing area (visuals rebuilt later)
 *
 * All dashboard management (current vs custom, preview, swap, edit content)
 * lives in the dedicated Dashboard Manager page.
 */
import React, { useState, useEffect } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { PageHeader } from '../components/ui/page-header';
import ExportButtons from '../components/ExportButtons';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { WELCOME_BACK_DURATION_MS } from '../constants/welcome';

const ANALYST_KPI_POLL_INTERVAL_MS = 60000; // 60s – keep KPIs fresh for analysts

const AnalystDashboard = () => {
  const { user } = useAuth();
  const [loadingStats, setLoadingStats] = useState(true);
  const [stats, setStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);

  const loadStats = async () => {
    try {
      if (!stats) {
        setLoadingStats(true);
      }
      const response = await axios.get('/api/dashboard/stats', {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
      });
      setStats(response.data);
    } catch (err) {
      console.error('Error loading analyst dashboard stats:', err);
    } finally {
      setLoadingStats(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, ANALYST_KPI_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), WELCOME_BACK_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  const lastName =
    (user?.last_name && user.last_name.toString().trim()) ||
    (user?.full_name && user.full_name.toString().trim().split(' ').slice(-1)[0]) ||
    user?.username ||
    '';

  return (
    <div className="space-y-4">
      <PageHeader
        title="Analytics Workspace"
        subtitle={
          showWelcome && lastName
            ? `Welcome back ${lastName} 🤗!`
            : 'Workspace under redesign (new analytics coming soon)'
        }
        actions={
          <>
            <Button
              onClick={() => {
                setRefreshing(true);
                loadStats();
              }}
              disabled={refreshing || loadingStats}
              className="gap-2"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing || loadingStats ? 'Refreshing…' : 'Refresh KPIs'}
            </Button>
            <ExportButtons filename="analyst_workspace" />
          </>
        }
      />

      {/* Legacy KPI grid removed – new semester-focused analytics will be added here */}
      {loadingStats && !stats ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card className="border border-dashed bg-muted/20">
          <CardHeader>
            <CardTitle className="text-sm">Analytics under redesign</CardTitle>
            <CardDescription className="text-xs">
              All legacy charts, KPIs, and filters have been removed. We are rebuilding the analyst
              experience to focus on current and previous semester analytics and new BI-grade visuals.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
};

export default AnalystDashboard;

