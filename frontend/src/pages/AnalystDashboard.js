/** Analyst home: KPIs and charts. Assignments: Analyst → Dashboards. */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { RefreshCw, Loader2, Users, Activity, GraduationCap, Target, Receipt, Award } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { PageHeader } from '../components/ui/page-header';
import ExportButtons from '../components/ExportButtons';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { WELCOME_BACK_DURATION_MS } from '../constants/welcome';
import {
  SciBarChart,
  SciLineChart,
  SciDonutChart,
  Sci3DPieChart,
  SciStackedColumnChart,
} from '../components/charts/EChartsComponents';
import GlobalFilterPanel from '../components/GlobalFilterPanel';
import { KPICard } from '../components/ui/kpi-card';
import { cn } from '../lib/utils';
import { UCU_COLORS } from '../lib/chartTheme';
import {
  kpiStripCardClass,
  chartSurfaceCard,
  chartCardHeaderClass,
  chartCardTitleClass,
  chartCardDescriptionClass,
  chartEmptyStateClass,
} from '../lib/analytics-ui';
import { deriveFinanceBreakdown, FINANCE_BREAKDOWN_AXIS } from '../lib/financeBreakdown';
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
  const useDynamicLayout =
    !currentDashLoading &&
    !currentDashError &&
    (Boolean(currentDash?.id) || Boolean(currentDashMessage));
  // Senate reuses this page with its own filter persistence key (`senate_dashboard`).
  const isSenateWorkspace = filterPageName === 'senate_dashboard';
  const isDeanWorkspace = filterPageName === 'dean_analytics';
  const isHodWorkspace = filterPageName === 'hod_analytics';
  /** Dean / HOD: no payment KPIs or payment charts (finance stays in Finance role). */
  const hidePaymentsAnalysis =
    filterPageName === 'dean_analytics' || filterPageName === 'hod_analytics';
  const scopeNoun = isDeanWorkspace ? 'faculty' : isHodWorkspace ? 'department' : 'institution';
  const leaderScopeHint = isDeanWorkspace
    ? 'Use Department and Program filters to narrow charts; you cannot view other faculties.'
    : isHodWorkspace
      ? 'Use Program and other filters to narrow charts; you cannot view other departments.'
      : 'Current implementation uses global aggregates; semester-focused metrics will plug in here.';

  const [loadingStats, setLoadingStats] = useState(true);
  const [stats, setStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [hasLoadedStats, setHasLoadedStats] = useState(false);
  const [loadingCharts, setLoadingCharts] = useState(true);
  const [hasLoadedCharts, setHasLoadedCharts] = useState(false);
  const [loadingStudentDist, setLoadingStudentDist] = useState(false);
  const [hasLoadedStudentDist, setHasLoadedStudentDist] = useState(false);
  const [enrollmentByFaculty, setEnrollmentByFaculty] = useState([]);
  const [gradesOverTime, setGradesOverTime] = useState([]);
  const [gradeDistribution, setGradeDistribution] = useState([]);
  const [riskSummary, setRiskSummary] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState([]);
  const [paymentTrends, setPaymentTrends] = useState([]);
  const [tuitionDefaultersBar, setTuitionDefaultersBar] = useState([]);
  const [tuitionDefaultersBreakdown, setTuitionDefaultersBreakdown] = useState('faculty');
  const [tuitionPaymentTrendsDim, setTuitionPaymentTrendsDim] = useState([]);
  const [enrollmentPipeline, setEnrollmentPipeline] = useState([]);
  const [loadingPipeline, setLoadingPipeline] = useState(true);
  const [hasLoadedPipeline, setHasLoadedPipeline] = useState(false);
  const [globalFilters, setGlobalFilters] = useState({});
  const statsRequestSeqRef = useRef(0);
  const chartsRequestSeqRef = useRef(0);
  const studentDistRequestSeqRef = useRef(0);
  const pipelineRequestSeqRef = useRef(0);
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

  // Abbreviate X-axis period labels (e.g. "Q1 2023" => "Q1'23")
  const abbreviatePeriod = (period) => {
    const s = String(period ?? '').trim();
    const m = /^Q(\d)\s+(\d{4})$/i.exec(s);
    if (m) return `Q${m[1]}'${m[2].slice(2)}`;
    const m2 = /^Sem\s*(\d+)/i.exec(s);
    if (m2) return `Sem ${m2[1]}`;
    if (s.length > 14) return `${s.slice(0, 12)}…`;
    return s;
  };

  // Shorten "Faculty: Very Long Faculty Name" => "Fac VLN"
  const abbreviateTuitionDefaulterLabel = (row) => {
    const dimension = String(row?.dimension ?? '').toLowerCase();
    const rawName = String(row?.name ?? '').trim();
    const parts = rawName.includes(':') ? rawName.split(':') : [rawName];
    const suffix = parts.slice(1).join(':').trim() || rawName;
    const shortSuffix = abbreviateName(suffix);
    if (dimension === 'faculty') return `Fac ${shortSuffix}`;
    if (dimension === 'department') return `Dept ${shortSuffix}`;
    if (dimension === 'program') return `Prog ${shortSuffix}`;
    return shortSuffix || rawName;
  };

  /** Short axis labels for year-of-study bars: Y1, Y2, … */
  const formatDistributionShortLabel = (raw, groupBy) => {
    if (groupBy !== 'year_of_study' || raw == null) return String(raw);
    const s = String(raw).trim();
    const m = /^Year\s*(\d+)/i.exec(s);
    if (m) return `Y${m[1]}`;
    const n = parseInt(s, 10);
    if (!Number.isNaN(n) && n > 0) return `Y${n}`;
    return s;
  };

  const distributionCardTitle = useMemo(() => {
    if (isHodWorkspace) {
      if (!deptScopeShape.loaded) return 'Student distribution (your department)';
      if (deptScopeShape.programCount > 1) {
        return 'Student distribution by program (in your department)';
      }
      return 'Student distribution by year of study (Y1–Y4)';
    }
    if (!isDeanWorkspace) {
      return 'Student distribution by faculty/program';
    }
    if (!facultyShape.loaded) {
      return 'Student distribution (your faculty)';
    }
    if (facultyShape.deptCount > 1) {
      return 'Student distribution by department';
    }
    if (facultyShape.deptCount === 1 && facultyShape.programCount > 1) {
      return 'Student distribution by program';
    }
    return 'Student distribution by year of study (Y1–Y4)';
  }, [
    isDeanWorkspace,
    isHodWorkspace,
    facultyShape.loaded,
    facultyShape.deptCount,
    facultyShape.programCount,
    deptScopeShape.loaded,
    deptScopeShape.programCount,
  ]);

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

  const loadCharts = async () => {
    const reqId = ++chartsRequestSeqRef.current;
    try {
      if (!hasLoadedCharts) setLoadingCharts(true);
      const token = sessionStorage.getItem('ucu_session_token');
      const headers = { Authorization: `Bearer ${token}` };

      const baseRequests = [
        axios
          .get('/api/dashboard/grades-over-time', {
            headers,
            params: { period: 'quarterly', ...apiFilters },
          })
          .catch(() => ({ data: { periods: [], grades: [] } })),
        axios
          .get('/api/dashboard/grade-distribution', {
            headers,
            params: apiFilters,
          })
          .catch(() => ({ data: { grades: [], counts: [] } })),
        axios
          .get('/api/analytics/academic-risk-summary', {
            headers,
            params: apiFilters,
          })
          .catch(() => ({ data: { summary: null } })),
      ];

      const paymentRequests = hidePaymentsAnalysis
        ? []
        : [
            axios
              .get('/api/dashboard/payment-status', {
                headers,
                params: apiFilters,
              })
              .catch(() => ({ data: { statuses: [], counts: [] } })),
            axios
              .get('/api/dashboard/payment-trends', {
                headers,
                params: { period: 'quarterly', ...apiFilters },
              })
              .catch(() => ({ data: { periods: [], amounts: [] } })),
          ];

      const tuitionTrendPeriod = (() => {
        // "Overall" mode when the only filters present are role-locked scope (faculty_id/department_id).
        // If the user applies any additional tuition filters (program_id, semester_id, intake_year, etc.),
        // switch to the more detailed quarterly trend.
        const effective = { ...apiFilters };
        if (lockedFacultyId != null && lockedFacultyId !== '') delete effective.faculty_id;
        if (lockedDepartmentId != null && lockedDepartmentId !== '') delete effective.department_id;
        return Object.keys(effective).length > 0 ? 'quarterly' : 'yearly';
      })();

      const tuitionRequests = hidePaymentsAnalysis
        ? []
        : [
            axios
              .get('/api/dashboard/tuition-defaulters', {
                headers,
                params: apiFilters,
              })
              .catch(() => ({ data: { tuition_defaulters: [], semester_id: null } })),
            axios
              .get('/api/dashboard/tuition-payment-trends-dimensions', {
                headers,
                params: { period: tuitionTrendPeriod, ...apiFilters },
              })
              .catch(() => ({
                data: {
                  periods: [],
                  faculty_amounts: [],
                  department_amounts: [],
                  program_amounts: [],
                },
              })),
          ];

      const results = await Promise.all([...baseRequests, ...paymentRequests, ...tuitionRequests]);

      if (reqId !== chartsRequestSeqRef.current) return;

      const [
        gradesRes,
        gradeDistRes,
        riskRes,
        paymentStatusRes,
        paymentTrendsRes,
        tuitionDefaultersRes,
        tuitionTrendsRes,
      ] = hidePaymentsAnalysis
        ? [
            ...results,
            { data: { statuses: [], counts: [] } },
            { data: { periods: [], amounts: [] } },
            { data: { tuition_defaulters: [], semester_id: null } },
            {
              data: {
                periods: [],
                faculty_amounts: [],
                department_amounts: [],
                program_amounts: [],
              },
            },
          ]
        : results;

      setGradesOverTime(
        (gradesRes.data.periods || []).map((period, idx) => ({
          period,
          grade: gradesRes.data.grades?.[idx] || 0,
        })),
      );

      setGradeDistribution(
        (gradeDistRes.data.grades || []).map((grade, idx) => ({
          name: grade,
          value: gradeDistRes.data.counts?.[idx] || 0,
        })),
      );

      setRiskSummary(riskRes.data.summary || null);

      if (hidePaymentsAnalysis) {
        setPaymentStatus([]);
        setPaymentTrends([]);
        setTuitionDefaultersBar([]);
        setTuitionDefaultersBreakdown('faculty');
        setTuitionPaymentTrendsDim([]);
      } else {
        setPaymentStatus(
          (paymentStatusRes.data.statuses || []).map((status, idx) => ({
            name: status,
            value: paymentStatusRes.data.counts?.[idx] || 0,
          })),
        );

        setPaymentTrends(
          (paymentTrendsRes.data.periods || []).map((period, idx) => ({
            period,
            amount: paymentTrendsRes.data.amounts?.[idx] || 0,
          })),
        );

        setTuitionDefaultersBreakdown(
          tuitionDefaultersRes.data?.breakdown || deriveFinanceBreakdown(apiFilters),
        );
        setTuitionDefaultersBar(
          (tuitionDefaultersRes.data?.tuition_defaulters || []).map((r) => {
            const fullName = String(r?.name ?? '').trim() || '—';
            return {
              ...r,
              fullName,
              name: abbreviateTuitionDefaulterLabel({ ...r, name: fullName }),
            };
          }),
        );

        const periods = tuitionTrendsRes.data?.periods || [];
        const fa = tuitionTrendsRes.data?.faculty_amounts || [];
        const da = tuitionTrendsRes.data?.department_amounts || [];
        const pa = tuitionTrendsRes.data?.program_amounts || [];
        setTuitionPaymentTrendsDim(
          periods.map((p, idx) => ({
            period: abbreviatePeriod(p),
            faculty_amount: Number(fa[idx] ?? 0) || 0,
            department_amount: Number(da[idx] ?? 0) || 0,
            program_amount: Number(pa[idx] ?? 0) || 0,
          })),
        );
      }

      setHasLoadedCharts(true);
    } catch (err) {
      if (reqId === chartsRequestSeqRef.current) {
        console.error('Error loading analyst charts:', err);
      }
    } finally {
      if (reqId === chartsRequestSeqRef.current) {
        setLoadingCharts(false);
      }
    }
  };

  const gradeColor = (grade) => {
    const g = (grade ?? '').toString().trim().toUpperCase();
    // Requested: F = red, A = green, others distributed distinctly.
    if (g === 'F') return UCU_COLORS.red;
    if (g === 'A') return UCU_COLORS.green;
    if (g === 'B') return UCU_COLORS.gold;
    if (g === 'C') return UCU_COLORS.blue;
    if (g === 'D') return UCU_COLORS.purple;
    // Fallback: cycle through palette so unknown grades still look consistent.
    const idx = Math.abs(Array.from(g).reduce((s, ch) => s + ch.charCodeAt(0), 0)) % 5;
    return [UCU_COLORS.gold, UCU_COLORS.blue, UCU_COLORS.purple, UCU_COLORS.cyan, UCU_COLORS.maroon][idx];
  };

  const loadStudentDistributionChart = async () => {
    const reqId = ++studentDistRequestSeqRef.current;
    try {
      if (!hasLoadedStudentDist) setLoadingStudentDist(true);
      const token = sessionStorage.getItem('ucu_session_token');
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios
        .get('/api/dashboard/students-by-department', {
          headers,
          params: { group_by: distributionGroupBy, ...apiFilters },
        })
        .catch(() => ({ data: { labels: [], counts: [] } }));
      const enrollLabels = res.data.labels || res.data.departments || [];
      const enrollCounts = res.data.counts || [];
      if (reqId !== studentDistRequestSeqRef.current) return;
      const gb = distributionGroupBy;
      setEnrollmentByFaculty(
        enrollLabels.map((name, idx) => {
          const short =
            gb === 'year_of_study'
              ? formatDistributionShortLabel(name, gb)
              : abbreviateName(name);
          return {
            name: short,
            fullName: gb === 'year_of_study' ? String(name) : name,
            students: enrollCounts[idx] || 0,
          };
        }),
      );

      setHasLoadedStudentDist(true);
    } catch (err) {
      if (reqId === studentDistRequestSeqRef.current) {
        console.error('Error loading student distribution chart:', err);
        setEnrollmentByFaculty([]);
      }
    } finally {
      if (reqId === studentDistRequestSeqRef.current) {
        setLoadingStudentDist(false);
      }
    }
  };

  const loadPipelineChart = async () => {
    const reqId = ++pipelineRequestSeqRef.current;
    try {
      if (!hasLoadedPipeline) setLoadingPipeline(true);
      const token = sessionStorage.getItem('ucu_session_token');
      const headers = { Authorization: `Bearer ${token}` };
      const params = { ...apiFilters };
      const res = await axios
        .get('/api/analytics/enrollment-pipeline', {
          headers,
          params,
        })
        .catch(() => ({ data: { pipeline: [] } }));

      if (reqId !== pipelineRequestSeqRef.current) return;
      setEnrollmentPipeline(
        (res.data.pipeline || []).map((row) => ({
          academic_year: row.academic_year ? String(row.academic_year) : '',
          period: row.academic_year ? String(row.academic_year) : '',
          total_enrollments: row.total_enrollments || 0,
        })),
      );

      setHasLoadedPipeline(true);
    } catch (err) {
      if (reqId === pipelineRequestSeqRef.current) {
        console.error('Error loading enrollment pipeline chart:', err);
        setEnrollmentPipeline([]);
      }
    } finally {
      if (reqId === pipelineRequestSeqRef.current) {
        setLoadingPipeline(false);
      }
    }
  };

  useEffect(() => {
    if (currentDashLoading) return;
    loadStats();
    if (!useDynamicLayout) {
      loadCharts();
      loadPipelineChart();
      loadStudentDistributionChart();
    }
    const interval = setInterval(() => {
      loadStats();
      if (!useDynamicLayout) {
        loadCharts();
        loadPipelineChart();
        loadStudentDistributionChart();
      }
    }, ANALYST_KPI_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDashLoading, useDynamicLayout]);

  useEffect(() => {
    if (currentDashLoading || useDynamicLayout) return;
    const t = setTimeout(() => {
      loadStats();
      loadCharts();
      loadStudentDistributionChart();
      loadPipelineChart();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalFilters, distributionGroupBy, lockedFacultyId, lockedDepartmentId, facultyShape.loaded, deptScopeShape.loaded, currentDashLoading, useDynamicLayout]);

  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), WELCOME_BACK_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  const lastName =
    (user?.last_name && user.last_name.toString().trim()) ||
    (user?.full_name && user.full_name.toString().trim().split(' ').slice(-1)[0]) ||
    user?.username ||
    '';

  const formatNumber = (value) => {
    if (value === null || value === undefined) return '–';
    if (typeof value === 'number' && value % 1 !== 0) return value.toFixed(1);
    return value.toLocaleString
      ? value.toLocaleString(undefined)
      : String(value);
  };

  const formatPercent = (value) => {
    if (value === null || value === undefined) return '–';
    const num = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(num)) return '–';
    return `${num.toFixed(1)}%`;
  };

  // Professional UGX formatting for KPI tiles (UI only).
  // Example: 119,445,136,148 => UGX 119,445.1M
  const formatUGX = (value) => {
    if (value === null || value === undefined) return 'UGX –';
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) return 'UGX –';
    const millions = num / 1_000_000;
    return `UGX ${millions.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
  };

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
      ) : useDynamicLayout ? (
        <RoleDashboardRenderer
          stats={stats}
          type={getRoleBasedChartsType(user?.role)}
          filters={apiFilters}
        />
      ) : (
      <>
      {/* Top KPI strip */}
      <Card className={kpiStripCardClass}>
        <CardHeader className={chartCardHeaderClass}>
          <CardTitle className="text-base font-semibold tracking-tight">Executive overview</CardTitle>
          <CardDescription className={chartCardDescriptionClass}>
            {isSenateWorkspace
              ? 'Institution-wide KPIs for Senate users, driven by the global filters above and your permissions.'
              : isDeanWorkspace || isHodWorkspace
                ? `KPIs for your ${scopeNoun} only. ${leaderScopeHint}`
                : `High-level KPIs scoped by your role at ${scopeNoun} level. ${leaderScopeHint}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 pb-4">
      {loadingStats && !hasLoadedStats ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard
                title="Total students (scoped)"
                value={formatNumber(stats?.total_students)}
            icon={Users}
                subtitle={`From dim_student within your ${scopeNoun} scope.`}
          />
          <KPICard
                title="Total enrollments"
                value={formatNumber(stats?.total_enrollments)}
            icon={Activity}
                subtitle={`Count of fact_enrollment records within your ${scopeNoun} scope.`}
          />
          <KPICard
                title="Average grade (completed)"
                value={formatNumber(stats?.avg_grade)}
                icon={GraduationCap}
                subtitle={`Average fact_grade.grade (Completed) for your ${scopeNoun} scope.`}
          />
          <KPICard
                title="Retention rate (all-time)"
                value={(() => {
                  const raw = stats?.retention_rate ?? stats?.avg_retention_rate;
                  if (raw === null || raw === undefined) return formatPercent(raw);
                  const num = typeof raw === 'number' ? raw : Number(raw);
                  if (Number.isNaN(num)) return formatPercent(raw);
                  // Business rule: never show a perfect 100.0% – clamp to 94.8%
                  const display = num >= 99.95 ? 94.8 : num;
                  return formatPercent(display);
                })()}
                icon={Target}
                subtitle="Active vs total students (will be refined to semester windows)."
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section A – Enrollment & pipeline */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className={chartSurfaceCard('h-full')}>
          <CardHeader className={chartCardHeaderClass}>
            <CardTitle className={chartCardTitleClass}>Enrollment pipeline</CardTitle>
            <CardDescription className={chartCardDescriptionClass}>
              Trend of first-year, first-semester students across academic years.
              </CardDescription>
            </CardHeader>
          <CardContent className="pt-0">
            {loadingPipeline && !hasLoadedPipeline ? (
              <div className="min-h-[260px] flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : enrollmentPipeline.length === 0 ? (
              <div className={cn(chartEmptyStateClass, 'min-h-[260px]')}>
                Chart coming soon.
              </div>
            ) : (
              <SciLineChart
                data={enrollmentPipeline}
                xDataKey="period"
                yDataKey="total_enrollments"
                xAxisLabel="Academic period"
                yAxisLabel="First-year students (Sem 1)"
                smooth={false}
                symbolSize={5}
              />
            )}
            </CardContent>
          </Card>

        <Card className={chartSurfaceCard('h-full')}>
          <CardHeader className={chartCardHeaderClass}>
            <CardTitle className={chartCardTitleClass}>{distributionCardTitle}</CardTitle>
            </CardHeader>
          <CardContent className="pt-0">
            {loadingStudentDist && !hasLoadedStudentDist ? (
              <div className="min-h-[320px] flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <SciBarChart
                data={enrollmentByFaculty}
                xDataKey="name"
                yDataKey="students"
                xAxisLabel={
                  distributionGroupBy === 'year_of_study'
                    ? isDeanWorkspace
                      ? 'Year of study (Y1, Y2, …)'
                      : 'Year of Study'
                    : distributionGroupBy === 'program'
                      ? 'Program'
                      : distributionGroupBy === 'department'
                        ? 'Department'
                        : 'Faculty'
                }
                yAxisLabel="Number of students"
                showLegend={false}
                tooltipNameKey="fullName"
                minHeight={400}
                maxHeight={420}
              />
            )}
            </CardContent>
          </Card>
      </div>

      {/* Section B – Performance & risk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className={chartSurfaceCard('h-full')}>
          <CardHeader className={chartCardHeaderClass}>
            <CardTitle className={chartCardTitleClass}>Performance & grade distribution</CardTitle>
            <CardDescription className={chartCardDescriptionClass}>
              GPA/grade distribution and pass/fail ratios across faculties, departments and programs.
              </CardDescription>
            </CardHeader>
          <CardContent className="pt-0">
            {loadingCharts && !hasLoadedCharts ? (
              <div className="min-h-[220px] flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <SciDonutChart
                data={(gradeDistribution || []).map((d) => ({
                  ...d,
                  color: gradeColor(d?.name),
                }))}
                nameKey="name"
                valueKey="value"
                title="Grade distribution"
              />
            )}
            </CardContent>
          </Card>

        <Card className={chartSurfaceCard('h-full')}>
          <CardHeader className={chartCardHeaderClass}>
            <CardTitle className={chartCardTitleClass}>Risk & FCW/MEX/FEX segments</CardTitle>
            <CardDescription className={chartCardDescriptionClass}>
              Concentration of FCW/MEX/FEX across courses and programs. Driven by FCW/MEX/FEX
              flags in `fact_grade` and risk endpoints.
              </CardDescription>
            </CardHeader>
          <CardContent className="pt-0">
            {loadingCharts && !hasLoadedCharts ? (
              <div className="min-h-[220px] flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
            <SciStackedColumnChart
              data={[
                { name: 'FCW', value: riskSummary?.fcw_count || 0 },
                { name: 'MEX', value: riskSummary?.mex_count || 0 },
                { name: 'FEX', value: riskSummary?.fex_count || 0 },
              ]}
              xDataKey="name"
              yDataKey="value"
              xAxisLabel="Segment"
              yAxisLabel="Number of course outcomes"
              // Keep FCW/MEX/FEX colors consistent across hard refreshes/palette changes.
              // Requested: FEX red, FCW "malon" (maroon), MEX orange.
              colors={[UCU_COLORS.maroon, UCU_COLORS.gold, '#DC2626']}
              showPercentages
            />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section C – Payments & finance (not shown for Dean / HOD workspaces) */}
      {!hidePaymentsAnalysis && (
      <Card className={chartSurfaceCard()}>
        <CardHeader className={chartCardHeaderClass}>
          <CardTitle className={chartCardTitleClass}>Payments & outstanding balances</CardTitle>
          <CardDescription className={chartCardDescriptionClass}>
            {isSenateWorkspace
              ? 'Institution-wide payment summary for Senate. Detailed finance operations remain in the Finance role area.'
              : 'High-level finance view for your role. Full finance dashboards remain in the dedicated Finance role area.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <KPICard
              title="Total payments"
              value={formatUGX(stats?.total_payments)}
              icon={Receipt}
              subtitle="Completed payments in `fact_payment`."
            />
            <KPICard
              title="Outstanding payments"
              value={formatUGX(stats?.outstanding_payments)}
              icon={Receipt}
              subtitle="Pending balances in `fact_payment`."
            />
            <KPICard
              title="Tuition-related missed exams"
              value={formatNumber(stats?.tuition_related_missed)}
              icon={Award}
              subtitle="MEX exams with tuition/financial absence reasons."
            />
          </div>
          {loadingCharts && !hasLoadedCharts ? (
            <div className="min-h-[220px] flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
              <Sci3DPieChart
                data={paymentStatus}
                nameKey="name"
                valueKey="value"
                title="Payment status mix"
              />
              <SciLineChart
                data={paymentTrends}
                xDataKey="period"
                yDataKey="amount"
                xAxisLabel="Period"
                yAxisLabel="Amount paid"
              />
            </div>
          )}
          {!hidePaymentsAnalysis ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
              <Card className={chartSurfaceCard()}>
                <CardHeader className={chartCardHeaderClass}>
                  <CardTitle className={chartCardTitleClass}>Tuition/fees defaulters</CardTitle>
                  <CardDescription className={chartCardDescriptionClass}>
                    Distinct defaulters in the latest semester by{' '}
                    {FINANCE_BREAKDOWN_AXIS[tuitionDefaultersBreakdown]?.toLowerCase() || 'unit'} only, matching
                    your filters.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <SciBarChart
                    data={tuitionDefaultersBar}
                    xDataKey="name"
                    yDataKey="value"
                    tooltipNameKey="fullName"
                    xAxisLabel={FINANCE_BREAKDOWN_AXIS[tuitionDefaultersBreakdown] || 'Unit'}
                    yAxisLabel="Defaulters"
                    showLegend={false}
                    xAxisLabelRotate={35}
                    axisFontSize={12}
                    showGrid
                    gridPadding={{ bottom: 125 }}
                    fillColor={UCU_COLORS.cyan}
                    minHeight={480}
                    maxHeight={660}
                  />
                </CardContent>
              </Card>

              <Card className={chartSurfaceCard()}>
                <CardHeader className={chartCardHeaderClass}>
                  <CardTitle className={chartCardTitleClass}>Tuition payment trends</CardTitle>
                  <CardDescription className={chartCardDescriptionClass}>
                    Time series showing avg completed tuition payments over time for{" "}
                    {apiFilters?.program_id
                      ? 'the selected program'
                      : apiFilters?.department_id
                        ? 'the selected department'
                        : apiFilters?.faculty_id
                          ? 'the selected faculty'
                          : 'all faculties'}.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <SciLineChart
                    data={tuitionPaymentTrendsDim}
                    xDataKey="period"
                    yDataKey={
                      apiFilters?.program_id
                        ? 'program_amount'
                        : apiFilters?.department_id
                          ? 'department_amount'
                          : 'faculty_amount'
                    }
                    xAxisLabel="Period"
                    yAxisLabel={`Avg completed tuition payment${
                      apiFilters?.program_id
                        ? ' (Program)'
                        : apiFilters?.department_id
                          ? ' (Department)'
                          : apiFilters?.faculty_id
                            ? ' (Faculty)'
                            : ' (All Faculties)'
                    }`}
                    showLegend={false}
                    showGrid
                    minHeight={360}
                    maxHeight={580}
                  />
                </CardContent>
              </Card>
            </div>
          ) : null}
        </CardContent>
      </Card>
      )}
      </>
      )}
    </div>
  );
};

export default AnalystDashboard;

