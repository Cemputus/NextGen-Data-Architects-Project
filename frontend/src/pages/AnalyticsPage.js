/**
 * Generic Analytics Page - For roles that need analytics (HOD, Dean, Senate, Analyst, HR, Finance)
 */
import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import GlobalFilterPanel from '../components/GlobalFilterPanel';
import RoleBasedCharts from '../components/RoleBasedCharts';
import ModernStatsCards from '../components/ModernStatsCards';
import ExportButtons from '../components/ExportButtons';
import Charts from '../components/Charts';
import PageShell from '../components/shared/PageShell';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { loadPageState, savePageState } from '../utils/statePersistence';

const AnalyticsPage = ({ type = 'general' }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  
  // Treat role analytics pages as "live" views – always start with clean filters
  // so charts aren't silently filtered out by stale saved state.
  const isAnalyticsOverviewType = ['analyst', 'senate', 'hod', 'dean', 'hr', 'finance'].includes(type);

  // Load persisted state on mount (only for non-overview uses)
  const savedState = isAnalyticsOverviewType
    ? { filters: {} }
    : loadPageState(`${type}_analytics`, { filters: {} });
  const [filters, setFilters] = useState(savedState.filters || {});

  // Save state whenever it changes (skip for live analytics overview pages)
  useEffect(() => {
    if (!isAnalyticsOverviewType) {
      savePageState(`${type}_analytics`, { filters });
    }
  }, [filters, type, isAnalyticsOverviewType]);

  useEffect(() => {
    loadAnalytics();
  }, [filters]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const endpoint = type === 'finance' ? '/api/analytics/finance' : '/api/dashboard/stats';
      const response = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
        params: filters
      });
      setStats(response.data);
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    const titles = {
      'hod': 'Department Analytics',
      'dean': 'Faculty Analytics',
      'senate': 'Institution Analytics',
      'analyst': 'Analytics Workspace',
      'hr': 'HR Analytics',
      'finance': 'Financial Analytics',
      'general': 'Analytics'
    };
    return titles[type] || 'Analytics';
  };

  const isWorkspace = type === 'analyst';

  const headerSection = (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">{getTitle()}</h1>
          <p className="text-sm text-muted-foreground">
            {isWorkspace
              ? 'Comprehensive analytics workspace with cascading filters and rich visualizations'
              : 'Comprehensive analytics and insights'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
          {(type === 'hr' || type === 'senate') && (
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <span className="text-muted-foreground font-medium">Employee role filter:</span>
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={filters.role_group || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setFilters((prev) => {
                    const next = { ...prev };
                    if (!value) {
                      delete next.role_group;
                    } else {
                      next.role_group = value;
                    }
                    return next;
                  });
                }}
              >
                <option value="">All roles</option>
                <option value="dean">Deans / Faculty heads</option>
                <option value="hod">HODs</option>
                <option value="lecturer">Lecturers</option>
                <option value="assistant_lecturer">Assistant Lecturers</option>
                {!filters.faculty_id && (
                  <>
                    <option value="senate">Senate members</option>
                    <option value="finance">Finance staff</option>
                    <option value="hr">HR staff</option>
                  </>
                )}
                <option value="other">Other employees</option>
              </select>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilters({})}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              <RotateCcw className="h-3 w-3" />
              Reset filters
            </button>
            <ExportButtons 
              stats={stats} 
              filters={filters} 
              filename={`${type}_analytics`}
              chartSelectors={[
                '.recharts-wrapper', // All recharts components
                '[class*="chart"]',
                '[data-chart]'
              ]}
            />
          </div>
        </div>
      </div>

      <GlobalFilterPanel
        onFilterChange={(next) => {
          const isEmployeeRolePage = type === 'hr' || type === 'senate';
          if (!isEmployeeRolePage) {
            setFilters(next);
            return;
          }
          const cleaned = { ...next };
          if (
            cleaned.faculty_id &&
            (cleaned.role_group === 'finance' ||
              cleaned.role_group === 'hr' ||
              cleaned.role_group === 'senate')
          ) {
            delete cleaned.role_group;
          }
          setFilters(cleaned);
        }}
        pageName={`${type}_analytics`}
        hideHighSchool={type === 'hr'}
        hideAcademic={type === 'hr'}
      />
    </div>
  );

  const bodySection = (
    <>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <ModernStatsCards stats={stats} type={type} />
          <Card className="border shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-semibold">Analytics Overview</CardTitle>
              <CardDescription className="text-xs">Detailed analytics and visualizations</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0" data-chart-container="true">
              <RoleBasedCharts filters={filters} type={type} />
            </CardContent>
          </Card>
          {isWorkspace && (
            <Card className="border shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Analytics Workspace Charts
                </CardTitle>
                <CardDescription className="text-xs">
                  Student distribution, grade trends, payments, and attendance — all driven by the global cascading Filters panel.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3 sm:space-y-4">
                <Charts data={stats} filters={filters} type={type} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </>
  );

  if (isWorkspace) {
    return (
      <PageShell
        title="Analytics Workspace"
        breadcrumbs={[{ label: 'Analytics' }, { label: 'Workspace' }]}
        actions={
          <ExportButtons
            stats={stats}
            filters={filters}
            filename={`${type}_analytics`}
            chartSelectors={['.recharts-wrapper', '[class*="chart"]', '[data-chart]']}
          />
        }
      >
        {headerSection}
        {bodySection}
      </PageShell>
    );
  }

  return (
    <div className="space-y-4">
      {headerSection}
      {bodySection}
    </div>
  );
};

export default AnalyticsPage;






