/**
 * Academic Risk Dashboard
 * Comprehensive analysis of students at risk (FCW, MEX, FEX)
 * Includes High School background correlation analysis
 */
import React, { useState, useEffect, useMemo } from 'react';
import { ShieldAlert, TrendingDown, AlertTriangle, GraduationCap, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import GlobalFilterPanel from '../components/GlobalFilterPanel';
import ExportButtons from '../components/ExportButtons';
import { KPICard } from '../components/ui/kpi-card';
import { DashboardGrid } from '../components/ui/dashboard-grid';
import axios from 'axios';
import { SciBarChart, SciDonutChart, SciLineChart } from '../components/charts/EChartsComponents';
import { loadPageState, savePageState, saveFilters } from '../utils/statePersistence';
import { DataTable } from '../components/shared/DataTable';
import { FilterChips } from '../components/shared/FilterChips';
import { SkeletonTable } from '../components/ui/skeleton';
import { exportTableToExcel } from '../utils/exportUtils';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import {
  chartSurfaceCard,
  chartCardHeaderClass,
  chartCardTitleClass,
  chartCardDescriptionClass,
  chartEmptyStateClass,
} from '../lib/analytics-ui';
import { sanitizeDashboardFilters } from '../utils/filterUtils';

const RISK_TAB_VALUES = ['summary', 'hs-correlation', 'districts', 'action'];
const RISK_TAB_SET = new Set(RISK_TAB_VALUES);

const AcademicRiskDashboard = () => {
    const { user } = useAuth();
    const role = (user?.role || '').toString().toLowerCase();
    const isDean = role === 'dean';
    const isHod = role === 'hod';
    const lockedFacultyId =
        isDean && user?.faculty_id != null && user?.faculty_id !== ''
            ? user.faculty_id
            : undefined;
    const lockedDepartmentId =
        isHod && user?.department_id != null && user?.department_id !== ''
            ? user.department_id
            : undefined;

    const filtersWithRoleLocks = (base = {}) => {
        const next = { ...base };
        if (lockedFacultyId != null && lockedFacultyId !== '') {
            next.faculty_id = String(lockedFacultyId);
        }
        if (lockedDepartmentId != null && lockedDepartmentId !== '') {
            next.department_id = String(lockedDepartmentId);
        }
        return sanitizeDashboardFilters(next);
    };

    const [loading, setLoading] = useState(true);
    const [riskData, setRiskData] = useState(null);
    const [correlationData, setCorrelationData] = useState(null);

    const savedState = loadPageState('academic_risk_dashboard', { filters: {}, tab: 'summary' });
    const safeInitialTab = RISK_TAB_SET.has(savedState?.tab) ? savedState.tab : 'summary';
    // Filters should come exclusively from GlobalFilterPanel persistence (not loadPageState).
    const [filters, setFilters] = useState({});
    /** Remount GlobalFilterPanel after chip-based clears so UI matches parent filter state (avoids blank / inconsistent views). */
    const [filterPanelKey, setFilterPanelKey] = useState(0);
    const [activeTab, setActiveTab] = useState(safeInitialTab);

    const FILTER_PAGE = 'academic_risk_dashboard';

    useEffect(() => {
        loadData();
    }, [filters]);

    // Persist tab only; keep filter persistence handled by GlobalFilterPanel.
    useEffect(() => {
        savePageState('academic_risk_dashboard', { filters: {}, tab: activeTab });
    }, [activeTab]);

    // Radix Tabs shows no panel content if `value` does not match any TabsTrigger (stale localStorage etc.).
    useEffect(() => {
        if (!RISK_TAB_SET.has(activeTab)) {
            setActiveTab('summary');
        }
    }, [activeTab]);

    const loadData = async () => {
        try {
            setLoading(true);
            const token = sessionStorage.getItem('ucu_session_token');
            const headers = { Authorization: `Bearer ${token}` };

            const params = filtersWithRoleLocks(filters);
            const [riskRes, corrRes] = await Promise.all([
                axios.get('/api/analytics/academic-risk', { headers, params }),
                axios.get('/api/analytics/high-school-risk-correlation', { headers, params })
            ]);

            setRiskData(riskRes.data);
            setCorrelationData(corrRes.data);
        } catch (err) {
            console.error('Error loading risk data:', err);
        } finally {
            setLoading(false);
        }
    };

    const riskSummary = riskData?.summary || { fcw_count: 0, mex_count: 0, fex_count: 0, total_courses: 0, avg_grade: 0 };
    const avgGradeNum = Number(riskSummary.avg_grade);
    const avgGradeSafe = Number.isFinite(avgGradeNum) ? avgGradeNum : 0;
    const correlations = correlationData?.by_school || [];

    /** API returns fcw_rate as 0–1 proportion; avg_gpa is ~0–100. Single axis made FCW bars invisible — scale FCW to % and use dual y-axis. */
    const hsCorrelationChartData = useMemo(() => {
        const list = correlationData?.by_school;
        if (!Array.isArray(list)) return [];
        return list.slice(0, 15).map((row) => {
            const raw = Number(row.fcw_rate);
            let fcwPct = 0;
            if (Number.isFinite(raw)) {
                fcwPct = raw >= 0 && raw <= 1 ? raw * 100 : raw;
            }
            const gpa = Number(row.avg_gpa);
            return {
                ...row,
                school: row.school,
                fcw_rate_pct: Math.round(fcwPct * 1000) / 1000,
                avg_gpa: Number.isFinite(gpa) ? Math.round(gpa * 1000) / 1000 : 0,
            };
        });
    }, [correlationData?.by_school]);

    const districtChartData = useMemo(() => {
        const list = correlationData?.by_district;
        if (!Array.isArray(list)) return [];
        return list.slice(0, 12).map((row) => {
            const raw = Number(row.avg_fcw_rate);
            let fcwPct = 0;
            if (Number.isFinite(raw)) {
                fcwPct = raw >= 0 && raw <= 1 ? raw * 100 : raw;
            }
            const grade = Number(row.avg_grade);
            return {
                ...row,
                district: row.district,
                avg_fcw_rate_pct: Math.round(fcwPct * 1000) / 1000,
                avg_grade: Number.isFinite(grade) ? Math.round(grade * 1000) / 1000 : 0,
            };
        });
    }, [correlationData?.by_district]);
    const rawTrend = riskData?.trends || riskData?.trend || riskData?.risk_over_time || [];
    const trendSource = Array.isArray(rawTrend) ? rawTrend : [];
    // Normalize legacy monthly rows → line chart shape (prefer semester API fields).
    const trend = trendSource.map((row) => {
        if (row.period != null) return row;
        const period =
            row.month_name != null && row.year != null
                ? `${row.month_name} ${row.year}`
                : String(row.semester_id ?? row.year ?? '');
        return {
            ...row,
            period,
            fcw_count: row.fcw_count ?? row.fcw ?? 0,
            mex_count: row.mex_count ?? row.mex ?? 0,
            fex_count: row.fex_count ?? row.fex ?? 0,
        };
    });

    const riskDistribution = [
        { name: 'FCW', value: riskSummary.fcw_count },
        { name: 'MEX', value: riskSummary.mex_count },
        { name: 'FEX', value: riskSummary.fex_count }
    ];

    const studentColumns = [
        { key: 'access_number', header: 'Reg No' },
        { key: 'first_name', header: 'First Name' },
        { key: 'last_name', header: 'Last Name' },
        {
            key: 'risk_points', header: 'Risk Points', render: (val) => (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${val >= 4 ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                    {val} Failures
                </span>
            )
        },
        { key: 'avg_grade', header: 'Avg Score', render: (val) => `${(val || 0).toFixed(1)}%` }
    ];

    const chartContainerClass = "min-h-[300px] w-full";

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
                        <ShieldAlert className="h-6 w-6 text-red-600" />
                        Academic Risk Dashboard
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Institution-wide view of academic, attendance, and financial risk – from headline KPIs to high school and district patterns,
                        ending with an actionable at-risk student list.
                    </p>
                </div>
                <div className="sm:shrink-0 sm:ml-4">
                    <ExportButtons
                        data={riskData}
                        filters={filters}
                        filename="academic_risk_analysis"
                        stats={riskSummary}
                    />
                </div>
            </div>

            {/* Filters - role-based: Dean starts at Department, HOD at Program */}
            <GlobalFilterPanel
                key={filterPanelKey}
                onFilterChange={(next) => setFilters(filtersWithRoleLocks(next || {}))}
                pageName={FILTER_PAGE}
                hideFaculty={isDean || isHod}
                hideDepartment={isHod}
                lockedFacultyId={lockedFacultyId}
                lockedDepartmentId={lockedDepartmentId}
                filterHint="Search by access number, reg no, or name. Cascade Faculty → Department → Program → Course → Semester → High School. Summary KPIs default to the latest semester when Semester is “All”."
            />

            <FilterChips
                filters={filters}
                onRemove={(key) => {
                    setFilters((prev) => {
                        const next = { ...prev };
                        delete next[key];
                        const locked = filtersWithRoleLocks(next);
                        saveFilters(FILTER_PAGE, locked);
                        return locked;
                    });
                    setFilterPanelKey((k) => k + 1);
                }}
                onClearAll={() => {
                    const locked = filtersWithRoleLocks({});
                    saveFilters(FILTER_PAGE, locked);
                    setFilters(locked);
                    setFilterPanelKey((k) => k + 1);
                }}
            />

            {loading ? (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-24 rounded-xl border border-border bg-card animate-pulse bg-muted/30" />
                        ))}
                    </div>
                    <SkeletonTable rows={6} cols={5} />
                </div>
            ) : (
                <>
                    {/* Risk KPIs */}
                    <DashboardGrid cols={{ default: 2, sm: 2, md: 4 }}>
                        <KPICard
                            title="FEX (Failed Exams)"
                            value={riskSummary.fex_count}
                            icon={AlertTriangle}
                            subtitle="Critical academic risk"
                            changeType="negative"
                        />
                        <KPICard
                            title="MEX (Missed Exams)"
                            value={riskSummary.mex_count}
                            icon={Calendar}
                            subtitle="Attendance & scheduling risk"
                            changeType="neutral"
                        />
                        <KPICard
                            title="FCW (failed coursework)"
                            value={riskSummary.fcw_count}
                            icon={TrendingDown}
                            subtitle="Coursework / clearance flags (FCW)"
                            changeType="negative"
                        />
                        <KPICard
                            title="Avg Academic Standing"
                            value={`${avgGradeSafe.toFixed(1)}%`}
                            icon={GraduationCap}
                            subtitle="Institutional average"
                            changeType={avgGradeSafe > 60 ? 'positive' : 'negative'}
                        />
                    </DashboardGrid>

                    {/* Main Content Tabs */}
                    <Tabs
                        value={RISK_TAB_SET.has(activeTab) ? activeTab : 'summary'}
                        onValueChange={setActiveTab}
                        className="space-y-4"
                    >
                        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 gap-1 p-1">
                            <TabsTrigger value="summary">Risk Summary</TabsTrigger>
                            <TabsTrigger value="hs-correlation">High School Correlation</TabsTrigger>
                            <TabsTrigger value="districts">District Analysis</TabsTrigger>
                            <TabsTrigger value="action">At-Risk Student List</TabsTrigger>
                        </TabsList>

                        <TabsContent value="summary" className="space-y-4">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <Card className={cn(chartSurfaceCard(), 'border-t-4 border-t-red-500')}>
                                    <CardHeader className={chartCardHeaderClass}>
                                        <CardTitle className={chartCardTitleClass}>Risk Type Distribution</CardTitle>
                                        <CardDescription className={chartCardDescriptionClass}>Relative contribution of FCW, MEX, and FEX to overall risk</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className={chartContainerClass}>
                                            <SciDonutChart
                                                data={riskDistribution}
                                                nameKey="name"
                                                valueKey="value"
                                                colors={['#7f1d1d', '#F59E0B', '#EF4444']}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className={cn(chartSurfaceCard(), 'border-t-4 border-t-indigo-500')}>
                                    <CardHeader className={chartCardHeaderClass}>
                                        <CardTitle className={chartCardTitleClass}>Institutional Stability</CardTitle>
                                        <CardDescription className={chartCardDescriptionClass}>Academic standing overview for the current filter window</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex flex-col items-center justify-center h-full space-y-6 py-8">
                                            <div className="relative h-48 w-48 flex items-center justify-center">
                                                <div className="absolute inset-0 rounded-full border-8 border-gray-100 dark:border-gray-800"></div>
                                                <div className="absolute inset-0 rounded-full border-8 border-indigo-500 border-t-transparent animate-pulse-slow" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }}></div>
                                                <div className="text-center">
                                                    <span className="text-5xl font-black text-indigo-600">{(riskSummary.avg_grade || 0).toFixed(0)}</span>
                                                    <span className="text-xl font-bold text-indigo-400 font-mono">%</span>
                                                    <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Avg Score</div>
                                                </div>
                                            </div>
                                            <div className="text-center max-w-xs">
                                                <p className="text-sm text-muted-foreground">
                                                    The current institutional academic standing is{' '}
                                                    <strong>{riskSummary.avg_grade > 60 ? 'Healthy' : 'Challenging'}</strong> based on processed grade records
                                                    in the selected faculty/department or institution-wide view.
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                            <Card className={chartSurfaceCard()}>
                                <CardHeader className={chartCardHeaderClass}>
                                    <CardTitle className={chartCardTitleClass}>Risk Trend by Semester</CardTitle>
                                    <CardDescription className={chartCardDescriptionClass}>
                                        How FEX, MEX, and FCW counts evolve over recent semesters for the current scope.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className={chartContainerClass}>
                                        {trend && trend.length > 0 ? (
                                            <SciLineChart
                                                data={trend}
                                                xDataKey="period"
                                                yDataKeys={[
                                                    { key: 'fex_count', label: 'FEX', color: '#EF4444' },
                                                    { key: 'mex_count', label: 'MEX', color: '#F59E0B' },
                                                    { key: 'fcw_count', label: 'FCW', color: '#7f1d1d' },
                                                ]}
                                                xAxisLabel="Semester"
                                                yAxisLabel="Count of grade events"
                                                showLegend
                                            />
                                        ) : (
                                            <div className={cn(chartEmptyStateClass, 'min-h-[260px]')}>
                                                No trend data available for the current filters.
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="hs-correlation" className="space-y-4">
                            <Card className={cn(chartSurfaceCard(), 'border-t-4 border-t-blue-600')}>
                                <CardHeader className={chartCardHeaderClass}>
                                    <CardTitle className={chartCardTitleClass}>High School Background vs. FCW Rate</CardTitle>
                                    <CardDescription className={chartCardDescriptionClass}>Analyzing which schools correlate with higher financial/academic risk</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="min-h-[460px] w-full">
                                        {hsCorrelationChartData.length > 0 ? (
                                            <SciBarChart
                                                data={hsCorrelationChartData}
                                                xDataKey="school"
                                                yDataKeys={[
                                                    {
                                                        key: 'fcw_rate_pct',
                                                        label: 'FCW Rate (%)',
                                                        color: '#EF4444',
                                                        yAxisIndex: 0,
                                                    },
                                                    {
                                                        key: 'avg_gpa',
                                                        label: 'Avg GPA',
                                                        color: '#3B82F6',
                                                        yAxisIndex: 1,
                                                    },
                                                ]}
                                                xAxisLabel="High School"
                                                yAxisLabel="FCW rate (%)"
                                                secondaryYAxisLabel="Avg GPA (score)"
                                                showLegend={true}
                                                showGrid={true}
                                                xAxisLabelRotate={32}
                                                gridPadding={{ bottom: 120 }}
                                                minHeight={480}
                                                maxHeight={560}
                                            />
                                        ) : (
                                            <div className={cn(chartEmptyStateClass, 'min-h-[460px]')}>
                                                No correlation data found for current filters.
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="districts" className="space-y-4">
                            <Card className={cn(chartSurfaceCard(), 'border-t-4 border-t-emerald-600')}>
                                <CardHeader className={chartCardHeaderClass}>
                                    <CardTitle className={chartCardTitleClass}>Risk by High School District</CardTitle>
                                    <CardDescription className={chartCardDescriptionClass}>Regional analysis of student failure rates</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className={chartContainerClass}>
                                        {districtChartData.length > 0 ? (
                                            <SciBarChart
                                                data={districtChartData}
                                                xDataKey="district"
                                                yDataKeys={[
                                                    {
                                                        key: 'avg_fcw_rate_pct',
                                                        label: 'Avg FCW Rate (%)',
                                                    color: '#f59e0b',
                                                        yAxisIndex: 0,
                                                    },
                                                    {
                                                        key: 'avg_grade',
                                                        label: 'Avg Grade %',
                                                    color: '#3B82F6',
                                                        yAxisIndex: 1,
                                                    },
                                                ]}
                                                xAxisLabel="District"
                                                yAxisLabel="FCW rate (%)"
                                                secondaryYAxisLabel="Avg grade (%)"
                                                showLegend={true}
                                            />
                                        ) : (
                                            <div className={cn(chartEmptyStateClass, 'min-h-[260px]')}>
                                                Processing district data...
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="action" className="space-y-4">
                            <Card className={chartSurfaceCard()}>
                                <CardHeader className={chartCardHeaderClass}>
                                    <CardTitle className={chartCardTitleClass}>Priority Student List</CardTitle>
                                    <CardDescription className={chartCardDescriptionClass}>Top students needing academic intervention</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <DataTable
                                        data={riskData?.at_risk_students || []}
                                        columns={studentColumns}
                                        itemsPerPage={15}
                                        searchable
                                        searchPlaceholder="Search students..."
                                        onExport={(data) => exportTableToExcel(data, studentColumns, 'academic_risk_students')}
                                    />
                                    <div className="mt-4 text-xs text-muted-foreground bg-amber-50 p-3 rounded-md border border-amber-100 flex items-start gap-2">
                                        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                                        <span>
                                            <strong>Intervention Protocol:</strong> Students with 2+ failures are automatically flagged for HOD review.
                                            Contact departmental counselors to schedule mandatory advising sessions.
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </>
            )}
        </div>
    );
};

export default AcademicRiskDashboard;
