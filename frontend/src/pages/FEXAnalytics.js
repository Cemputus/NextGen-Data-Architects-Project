/**
 * FEX Analytics Page - Modern UI with Data Loading
 * Comprehensive FEX analysis with drilldown capabilities
 */
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingDown, AlertTriangle, FileText, Download, BarChart3, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import ExportButtons from '../components/ExportButtons';
import axios from 'axios';
import { SciBarChart, UCU_COLORS } from '../components/charts/EChartsComponents';
import { TableWrapper, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
import { EmptyState } from '../components/ui/state-messages';
import { Loader2 } from 'lucide-react';
import { loadPageState, savePageState } from '../utils/statePersistence';

import { useNavigate } from 'react-router-dom';
import { PageHeader, PageContent } from '../components/ui/page-header';
import GlobalFilterPanel from '../components/GlobalFilterPanel';
import { useAuth } from '../context/AuthContext';
import { CHART_PALETTE } from '../config/designTokens';
import { sanitizeDashboardFilters } from '../utils/filterUtils';
import { Skeleton } from '../components/ui/skeleton';

const FEXAnalytics = ({ filters: externalFilters, onFilterChange: externalOnFilterChange }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = (user?.role || '').toString().toLowerCase();
  const isDean = role === 'dean';
  const isHod = role === 'hod';
  const lockedFacultyId =
    isDean && user?.faculty_id != null && user?.faculty_id !== '' ? user.faculty_id : undefined;
  const lockedDepartmentId =
    isHod && user?.department_id != null && user?.department_id !== ''
      ? user.department_id
      : undefined;
  const [loading, setLoading] = useState(true);
  const [fexData, setFexData] = useState(null);
  const [scopeError, setScopeError] = useState(null);

  const savedState = loadPageState('fex_analytics', { filters: {}, drilldown: 'faculty', tab: 'distribution' });
  // Keep filters hydrated by GlobalFilterPanel persistence (statePersistence.loadFilters).
  // This matches the Analyst Workspace behavior and avoids mixing `loadPageState(filters)`
  // with `loadFilters(pageName)` which use different localStorage keys.
  const [internalFilters, setInternalFilters] = useState({});
  const [activeTab, setActiveTab] = useState(savedState.tab || 'distribution');

  const filters = externalFilters != null ? externalFilters : internalFilters;
  const isControlled = externalFilters != null;

  // Match Analyst Workspace cascading behavior:
  // - Department selected => chart groups by Program
  // - Program selected => chart groups by Year of Study
  // - Faculty selected (fallback) => chart groups by Department
  // - Nothing selected => chart groups by Faculty
  // Role-aware drilldown:
  // - Senate: starts at Faculty
  // - Dean: faculty is fixed (JWT) so start at Department
  // - HoD: department is fixed (JWT) so start at Program
  // - If a deeper cascading filter exists (e.g. course_code), group by it.
  const drilldown = (() => {
    if (filters.course_code) return 'course';

    if (isHod) {
      if (filters.program_id) return 'year_of_study';
      return 'program';
    }

    if (isDean) {
      if (filters.program_id) return 'year_of_study';
      if (filters.department_id) return 'program';
      return 'department';
    }

    if (filters.program_id) return 'year_of_study';
    if (filters.department_id) return 'program';
    if (filters.faculty_id) return 'department';
    return 'faculty';
  })();

  useEffect(() => {
    if (!isControlled) savePageState('fex_analytics', { filters: {}, tab: activeTab });
  }, [isControlled, activeTab]);

  useEffect(() => {
    loadFEXData();
  }, [filters, drilldown]);

  const loadFEXData = async () => {
    try {
      setLoading(true);
      setScopeError(null);
      if (isDean && (user?.faculty_id == null || user?.faculty_id === '')) {
        setScopeError('Your account has no faculty assigned. Ask an administrator to set your faculty for scoped FEX analytics.');
        setFexData({ data: [], summary: { total_fex: 0, total_mex: 0, total_fcw: 0, total_completed: 0, fex_rate: 0 } });
        return;
      }
      if (isHod && (user?.department_id == null || user?.department_id === '')) {
        setScopeError('Your account has no department assigned. Ask an administrator to set your department for scoped FEX analytics.');
        setFexData({ data: [], summary: { total_fex: 0, total_mex: 0, total_fcw: 0, total_completed: 0, fex_rate: 0 } });
        return;
      }

      const response = await axios.get('/api/analytics/fex', {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
        params: { ...sanitizeDashboardFilters(filters), drilldown },
      });

      if (response.data && response.data.data) {
        setFexData(response.data);
      } else if (response.data && Array.isArray(response.data)) {
        const summary = {
          total_fex: response.data.reduce((sum, item) => sum + (item.total_fex || 0), 0),
          total_mex: response.data.reduce((sum, item) => sum + (item.total_mex || 0), 0),
          total_fcw: response.data.reduce((sum, item) => sum + (item.total_fcw || 0), 0),
          total_completed: response.data.reduce((sum, item) => sum + (item.total_completed || 0), 0),
          fex_rate: 0
        };
        const totalExams = summary.total_fex + summary.total_mex + summary.total_fcw + summary.total_completed;
        summary.fex_rate = totalExams > 0 ? (summary.total_fex / totalExams * 100).toFixed(2) : 0;
        setFexData({ data: response.data, summary });
      } else {
        setFexData({ data: [], summary: { total_fex: 0, total_mex: 0, total_fcw: 0, total_completed: 0, fex_rate: 0 } });
      }
    } catch (err) {
      console.error('Error loading FEX data:', err);
      if (err.response?.status === 403) {
        const msg =
          err.response?.data?.detail ||
          err.response?.data?.error ||
          'Not allowed to view FEX for this scope.';
        setScopeError(msg);
        setFexData({ data: [], summary: { total_fex: 0, total_mex: 0, total_fcw: 0, total_completed: 0, fex_rate: 0 } });
      } else if (!fexData) {
        setFexData({ data: [], summary: { total_fex: 0, total_mex: 0, total_fcw: 0, total_completed: 0, fex_rate: 0 } });
      }
    } finally {
      setLoading(false);
    }
  };

  const COLORS = CHART_PALETTE;

  const getDataKey = () => {
    if (drilldown === 'faculty') return 'faculty_name';
    if (drilldown === 'department') return 'department';
    if (drilldown === 'program') return 'program_name';
    if (drilldown === 'year_of_study') return 'year_label';
    if (drilldown === 'course') return 'course_name';
    return 'faculty_name';
  };

  const summary = fexData?.summary || {
    total_fex: 0,
    total_mex: 0,
    total_fcw: 0,
    total_completed: 0,
    fex_rate: 0
  };

  const chartData = fexData?.data || [];
  const chartContainerClass = "min-h-[320px] max-h-[460px] w-full";

  const abbreviateName = (name) => {
    if (!name) return '';
    const trimmed = name.toString().trim();
    if (!trimmed) return '';
    const words = trimmed.split(/\s+/);
    if (words.length === 1) {
      return trimmed.length > 10 ? `${trimmed.slice(0, 10)}…` : trimmed;
    }
    return words.map((w) => w[0]).join('').toUpperCase();
  };

  // Match “Student distribution labels + tooltip” behavior:
  // - x-axis uses abbreviated `name`
  // - tooltip uses full `fullName`
  const chartDataForChart = (chartData || []).map((row) => {
    const key = getDataKey();
    const fullName = row?.[key] ?? '';
    const axisName =
      drilldown === 'year_of_study' ? String(fullName || '') : abbreviateName(String(fullName || ''));
    return {
      ...row,
      name: axisName,
      fullName: String(fullName || ''),
    };
  });

  const xAxisLabel =
    drilldown === 'faculty'
      ? 'Faculty'
      : drilldown === 'department'
        ? 'Department'
        : drilldown === 'program'
          ? 'Program'
          : drilldown === 'course'
            ? 'Course'
            : 'Year of Study';

  const rolePrefix = user?.role?.toLowerCase() === 'sysadmin' ? 'admin' : user?.role?.toLowerCase() || 'dashboard';

  return (
    <PageContent>
      <PageHeader
        title="FEX Analytics"
        description="Deep dive into failed exams and performance bottlenecks, focused on the current semester by default unless you choose a specific period."
        actions={
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/${rolePrefix}/risk`)}
              className="gap-2 border-red-200 text-red-700 hover:bg-red-50"
            >
              <ShieldAlert className="h-4 w-4" />
              Risk Analysis
            </Button>
            <ExportButtons
              data={fexData?.data}
              filters={{ ...filters, drilldown }}
              filename="fex_analytics"
              stats={summary}
            />
          </div>
        }
      />

      {!isControlled && (
        <>
          {(isDean && (user?.faculty_id == null || user?.faculty_id === '')) ||
          (isHod && (user?.department_id == null || user?.department_id === '')) ? (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100 dark:border-amber-800">
              {isDean ? (
                <>
                  Your account has no <strong>faculty</strong> assigned. FEX analytics will stay empty until an
                  administrator sets your faculty.
                </>
              ) : (
                <>
                  Your account has no <strong>department</strong> assigned. FEX analytics will stay empty until an
                  administrator sets your department.
                </>
              )}
            </div>
          ) : null}
          {scopeError &&
          !(
            (isDean && (user?.faculty_id == null || user?.faculty_id === '')) ||
            (isHod && (user?.department_id == null || user?.department_id === ''))
          ) ? (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
              {scopeError}
            </div>
          ) : null}
          <GlobalFilterPanel
            onFilterChange={setInternalFilters}
            pageName="fex_analytics"
            hideFaculty={isDean || isHod}
            hideDepartment={isHod}
            lockedFacultyId={lockedFacultyId}
            lockedDepartmentId={lockedDepartmentId}
            filterHint={
              isHod
                ? 'Scoped to your department. Cascade Program → Semester → Year of Study; chart drilldown follows your selections.'
                : isDean
                  ? 'Scoped to your faculty. Cascade Department → Program → Semester → Year of Study; chart drilldown follows your selections.'
                  : 'Senate: institution-wide FEX. Use Faculty → Department → Program → Semester to narrow; chart groups by the next level down.'
            }
          />
        </>
      )}

      {loading ? (
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-full max-w-md" />
          <Skeleton className="h-[280px] w-full rounded-md" />
        </div>
      ) : (
        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base font-semibold text-red-700">
              FEX distribution
            </CardTitle>
            <CardDescription className="text-xs">
              KPI cards were removed to avoid duplicate KPI sections. Use cascading filters to refine scope.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div
              className={chartContainerClass}
              data-chart-title={`FEX Distribution by ${xAxisLabel}`}
              data-chart-container="true"
            >
              {chartData.length > 0 ? (
                <SciBarChart
                  data={chartDataForChart}
                  xDataKey="name"
                  yDataKeys={[
                    { key: 'total_fex', label: 'FEX', color: '#ef4444' },
                    { key: 'total_mex', label: 'MEX', color: '#f59e0b' },
                    { key: 'total_fcw', label: 'FCW', color: '#8b5cf6' }
                  ]}
                  xAxisLabel={xAxisLabel}
                  yAxisLabel="Count"
                  showLegend={true}
                  showGrid={true}
                  tooltipNameKey="fullName"
                  tooltipMode="breakdown"
                  minHeight={400}
                  maxHeight={440}
                />
              ) : (
                <EmptyState
                  icon={FileText}
                  message="No data available"
                  hint={
                    fexData?.debug_info?.message
                    || (fexData?.debug_info?.total_records_in_db === 0
                      ? 'No grade rows match these filters (including High School). Try clearing High School or widening Faculty / Department / Semester.'
                      : 'Try adjusting filters or clearing High School to see if results appear.')
                  }
                  className="border-2 border-dashed rounded-lg"
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </PageContent>
  );
};

export default FEXAnalytics;
