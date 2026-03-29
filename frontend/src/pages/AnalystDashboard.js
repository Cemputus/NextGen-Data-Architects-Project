/** Analyst home: KPIs and charts. Assignments: Analyst → Dashboards. */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { PageHeader } from '../components/ui/page-header';
import ExportButtons from '../components/ExportButtons';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { WELCOME_BACK_DURATION_MS } from '../constants/welcome';
import GlobalFilterPanel from '../components/GlobalFilterPanel';
import RoleDashboardRenderer from '../components/RoleDashboardRenderer';
import { useCurrentDashboard } from '../hooks/useCurrentDashboard';
import { getRoleBasedChartsType } from '../utils/roleDashboardChartType';

const ANALYST_KPI_POLL_INTERVAL_MS = 60000; // 60s – keep KPIs fresh for analysts

const AnalystDashboard = ({
  title = "Analytics Workspace",
  defaultSubtitle = "Institution-wide analytics workspace",
  exportFilename = "analyst_workspace",
  filterPageName = "analyst_analytics",
  /** When set (e.g. deans), every chart/API call includes this faculty_id; user cannot pick another faculty. */
  lockedFacultyId = undefined,
  /** When set (e.g. HODs), every chart/API call includes this department_id; user cannot pick another department. */
  lockedDepartmentId = undefined,
} = {}) => {
  const { user } = useAuth();
  const {
    loading: currentDashLoading,
    dashboard: currentDash,
    error: currentDashError,
    userMessage: currentDashMessage,
  } = useCurrentDashboard();
  const useAssignedDashboardLayout = !currentDashLoading && !currentDashError;
  const isDeanWorkspace = filterPageName === 'dean_analytics';
  const isHodWorkspace = filterPageName === 'hod_analytics';

  const [loadingStats, setLoadingStats] = useState(true);
  const [stats, setStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [hasLoadedStats, setHasLoadedStats] = useState(false);
  const [globalFilters, setGlobalFilters] = useState({});
  const statsRequestSeqRef = useRef(0);
  /** For deans: department/program counts in their faculty → drives default distribution dimension. */
  const [facultyShape, setFacultyShape] = useState({
    loaded: false,
    deptCount: 0,
    programCount: 0,
  });
  /** For HODs: program count in their department → program vs year-of-study default. */
  const [deptScopeShape, setDeptScopeShape] = useState({
    loaded: false,
    programCount: 0,
  });

  const apiFilters = useMemo(() => {
    const f = { ...globalFilters };
    if (lockedFacultyId != null && lockedFacultyId !== '') {
      f.faculty_id = String(lockedFacultyId);
    }
    if (lockedDepartmentId != null && lockedDepartmentId !== '') {
      f.department_id = String(lockedDepartmentId);
    }
    return f;
  }, [globalFilters, lockedFacultyId, lockedDepartmentId]);

  const distributionGroupBy = useMemo(() => {
    // User chose a program → always show year-of-study breakdown
    if (apiFilters?.program_id) return 'year_of_study';

    const hasDeptLock = lockedDepartmentId != null && lockedDepartmentId !== '';
    if (hasDeptLock && deptScopeShape.loaded) {
      const np = deptScopeShape.programCount;
      if (np > 1) return 'program';
      return 'year_of_study';
    }
    if (hasDeptLock && !deptScopeShape.loaded) return 'program';

    const hasFacultyLock = lockedFacultyId != null && lockedFacultyId !== '';

    if (hasFacultyLock && facultyShape.loaded) {
      // User narrowed to one department (multi-department faculty) → next level is programs
      if (apiFilters?.department_id) return 'program';

      const nd = facultyShape.deptCount;
      const np = facultyShape.programCount;
      if (nd > 1) return 'department';
      if (nd === 1 && np > 1) return 'program';
      return 'year_of_study';
    }

    if (hasFacultyLock && !facultyShape.loaded) return 'department';

    if (apiFilters?.department_id) return 'program';
    if (apiFilters?.faculty_id) return 'department';
    return 'faculty';
  }, [
    apiFilters,
    lockedFacultyId,
    lockedDepartmentId,
    facultyShape.loaded,
    facultyShape.deptCount,
    facultyShape.programCount,
    deptScopeShape.loaded,
    deptScopeShape.programCount,
  ]);

  useEffect(() => {
    if (lockedFacultyId == null || lockedFacultyId === '') {
      setFacultyShape({ loaded: false, deptCount: 0, programCount: 0 });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = sessionStorage.getItem('ucu_session_token');
        const res = await axios.get('/api/analytics/filter-options', {
          headers: { Authorization: `Bearer ${token}` },
          params: { faculty_id: lockedFacultyId },
        });
        if (cancelled) return;
        const depts = res.data?.departments || [];
        const progs = res.data?.programs || [];
        setFacultyShape({
          loaded: true,
          deptCount: depts.length,
          programCount: progs.length,
        });
      } catch (e) {
        if (!cancelled) {
          console.error('Error loading faculty shape for distribution chart:', e);
          setFacultyShape({ loaded: true, deptCount: 2, programCount: 2 });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lockedFacultyId]);

  useEffect(() => {
    if (lockedDepartmentId == null || lockedDepartmentId === '') {
      setDeptScopeShape({ loaded: false, programCount: 0 });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = sessionStorage.getItem('ucu_session_token');
        const res = await axios.get('/api/analytics/filter-options', {
          headers: { Authorization: `Bearer ${token}` },
          params: { department_id: lockedDepartmentId },
        });
        if (cancelled) return;
        const progs = res.data?.programs || [];
        setDeptScopeShape({
          loaded: true,
          programCount: progs.length,
        });
      } catch (e) {
        if (!cancelled) {
          console.error('Error loading department scope for distribution chart:', e);
          setDeptScopeShape({ loaded: true, programCount: 2 });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lockedDepartmentId]);

  const loadStats = async () => {
    const reqId = ++statsRequestSeqRef.current;
    try {
      const shouldShowLoader = !hasLoadedStats;
      if (shouldShowLoader) setLoadingStats(true);

      const response = await axios.get('/api/dashboard/stats', {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
        params: { ...apiFilters, lite: 1 },
      });

      if (reqId !== statsRequestSeqRef.current) return;
      setStats(response.data);
      setHasLoadedStats(true);
    } catch (err) {
      if (reqId === statsRequestSeqRef.current) {
        console.error('Error loading analyst dashboard stats:', err);
        // Keep existing stats on failure so KPIs don't disappear.
      }
    } finally {
      if (reqId === statsRequestSeqRef.current) {
        setLoadingStats(false);
        setRefreshing(false);
      }
    }
  };

  const skipDepartmentFilterDean =
    isDeanWorkspace && facultyShape.loaded && facultyShape.deptCount === 1;

  const leaderFilterHint = useMemo(() => {
    if (isDeanWorkspace) {
      if (!facultyShape.loaded) return 'Scoped to your faculty — preparing filters…';
      return skipDepartmentFilterDean
        ? 'Single department — start from Program, then Course, Semester, High School.'
        : 'Multiple departments — start from Department, then Program, Course, Semester, High School.';
    }
    if (isHodWorkspace) {
      if (!deptScopeShape.loaded) return 'Scoped to your department — preparing filters…';
      return 'Your department is fixed — use Program and other filters to narrow charts. You cannot view other departments.';
    }
    return '';
  }, [
    isDeanWorkspace,
    isHodWorkspace,
    facultyShape.loaded,
    skipDepartmentFilterDean,
    deptScopeShape.loaded,
  ]);

  useEffect(() => {
    if (currentDashLoading) return;
    loadStats();
    const interval = setInterval(() => {
      loadStats();
    }, ANALYST_KPI_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDashLoading]);

  useEffect(() => {
    if (currentDashLoading) return;
    const t = setTimeout(() => {
      loadStats();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalFilters, distributionGroupBy, lockedFacultyId, lockedDepartmentId, facultyShape.loaded, deptScopeShape.loaded, currentDashLoading]);

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
        title={title}
        subtitle={
          showWelcome && lastName
            ? `Welcome back ${lastName} 🤗!`
            : defaultSubtitle
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
            <ExportButtons filename={exportFilename} stats={stats} filters={apiFilters} />
          </>
        }
      />

      {/* Global filter panel */}
      <GlobalFilterPanel
        onFilterChange={(next) => {
          setGlobalFilters(next || {});
        }}
        pageName={filterPageName}
        lockedFacultyId={lockedFacultyId}
        lockedDepartmentId={lockedDepartmentId}
        skipDepartmentFilter={skipDepartmentFilterDean}
        filterHint={leaderFilterHint}
      />

      {currentDashLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <Loader2 className="h-9 w-9 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading dashboard layout…</p>
        </div>
      ) : useAssignedDashboardLayout ? (
        <RoleDashboardRenderer
          stats={stats}
          type={getRoleBasedChartsType(user?.role)}
          filters={apiFilters}
        />
      ) : (
        <div className="rounded-lg border border-dashed border-amber-200/80 bg-amber-50/40 dark:bg-amber-950/20 px-4 py-3 text-sm text-foreground/90">
          {currentDashError
            ? 'Could not load your assigned dashboard. Try refreshing the page.'
            : currentDashMessage || 'No dashboard is assigned for your role yet.'}
        </div>
      )}
    </div>
  );
};

export default AnalystDashboard;

