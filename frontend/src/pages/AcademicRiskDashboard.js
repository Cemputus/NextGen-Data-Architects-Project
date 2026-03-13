/**
 * Academic Risk Dashboard
 * Comprehensive analysis of students at risk (FCW, MEX, FEX)
 * Includes High School background correlation analysis
 */
import React, { useState, useEffect } from 'react';
import { ShieldAlert, TrendingDown, School, Users, AlertTriangle, GraduationCap, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import GlobalFilterPanel from '../components/GlobalFilterPanel';
import ExportButtons from '../components/ExportButtons';
import { KPICard } from '../components/ui/kpi-card';
import { DashboardGrid } from '../components/ui/dashboard-grid';
import axios from 'axios';
import { SciBarChart, SciDonutChart, UCU_COLORS } from '../components/charts/EChartsComponents';
import { Loader2 } from 'lucide-react';
import { loadPageState, savePageState } from '../utils/statePersistence';
import { DataTable } from '../components/shared/DataTable';

const AcademicRiskDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [riskData, setRiskData] = useState(null);
    const [correlationData, setCorrelationData] = useState(null);

    const savedState = loadPageState('academic_risk_dashboard', { filters: {}, tab: 'summary' });
    const [filters, setFilters] = useState(savedState.filters || {});
    const [activeTab, setActiveTab] = useState(savedState.tab || 'summary');

    useEffect(() => {
        loadData();
    }, [filters]);

    useEffect(() => {
        savePageState('academic_risk_dashboard', { filters, tab: activeTab });
    }, [filters, activeTab]);

    const loadData = async () => {
        try {
            setLoading(true);
            const token = sessionStorage.getItem('ucu_session_token');
            const headers = { Authorization: `Bearer ${token}` };

            const [riskRes, corrRes] = await Promise.all([
                axios.get('/api/analytics/academic-risk', { headers, params: filters }),
                axios.get('/api/analytics/high-school-risk-correlation', { headers, params: filters })
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
    const correlations = correlationData?.by_school || [];

    const riskDistribution = [
        { name: 'FCW (Finance)', value: riskSummary.fcw_count },
        { name: 'MEX (Missed Exams)', value: riskSummary.mex_count },
        { name: 'FEX (Failed Exams)', value: riskSummary.fex_count }
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-wrap">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
                        <ShieldAlert className="h-6 w-6 text-red-600" />
                        Academic Risk Dashboard
                    </h1>
                    <p className="text-sm text-muted-foreground">Monitoring students at risk and analyzing performance correlations</p>
                </div>
                <ExportButtons
                    data={riskData}
                    filters={filters}
                    filename="academic_risk_analysis"
                    stats={riskSummary}
                />
            </div>

            {/* Filters */}
            <GlobalFilterPanel onFilterChange={setFilters} pageName="academic_risk_dashboard" />

            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
                        <p className="text-sm text-muted-foreground font-medium">Analyzing institutional risk factors...</p>
                    </div>
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
                            title="FCW (Financial Retakes)"
                            value={riskSummary.fcw_count}
                            icon={TrendingDown}
                            subtitle="Financial clearance issues"
                            changeType="negative"
                        />
                        <KPICard
                            title="Avg Academic Standing"
                            value={`${(riskSummary.avg_grade || 0).toFixed(1)}%`}
                            icon={GraduationCap}
                            subtitle="Institutional average"
                            changeType={riskSummary.avg_grade > 60 ? 'positive' : 'negative'}
                        />
                    </DashboardGrid>

                    {/* Main Content Tabs */}
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 gap-1 p-1">
                            <TabsTrigger value="summary">Risk Summary</TabsTrigger>
                            <TabsTrigger value="hs-correlation">High School Correlation</TabsTrigger>
                            <TabsTrigger value="districts">District Analysis</TabsTrigger>
                            <TabsTrigger value="action">At-Risk Student List</TabsTrigger>
                        </TabsList>

                        <TabsContent value="summary" className="space-y-4">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <Card className="border-red-100 shadow-sm border-t-4 border-t-red-500">
                                    <CardHeader>
                                        <CardTitle className="text-base font-semibold">Risk Type Distribution</CardTitle>
                                        <CardDescription>Breakdown of different failure modes</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className={chartContainerClass}>
                                            <SciDonutChart
                                                data={riskDistribution}
                                                nameKey="name"
                                                valueKey="value"
                                                colors={['#F59E0B', '#3B82F6', '#EF4444']}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="border-indigo-100 shadow-sm border-t-4 border-t-indigo-500">
                                    <CardHeader>
                                        <CardTitle className="text-base font-semibold">Institutional Stability</CardTitle>
                                        <CardDescription>Academic standing overview</CardDescription>
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
                                                    The current institutional academic standing is <strong>{riskSummary.avg_grade > 60 ? 'Healthy' : 'Challenging'}</strong> based on processed grade records.
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        <TabsContent value="hs-correlation" className="space-y-4">
                            <Card className="border shadow-sm border-t-4 border-t-blue-600">
                                <CardHeader>
                                    <CardTitle className="text-base font-semibold">High School Background vs. FCW Rate</CardTitle>
                                    <CardDescription>Analyzing which schools correlate with higher financial/academic risk</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className={chartContainerClass}>
                                        {correlations.length > 0 ? (
                                            <SciBarChart
                                                data={correlations.slice(0, 15)}
                                                xDataKey="school"
                                                yDataKeys={[
                                                    { key: 'fcw_rate', label: 'FCW Rate (%)', color: '#EF4444' },
                                                    { key: 'avg_gpa', label: 'Avg GPA', color: '#3B82F6' }
                                                ]}
                                                xAxisLabel="High School"
                                                yAxisLabel="Percentage / GPA"
                                                showLegend={true}
                                                showGrid={true}
                                            />
                                        ) : (
                                            <div className="h-full flex items-center justify-center text-muted-foreground border border-dashed rounded-lg">
                                                No correlation data found for current filters.
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="districts" className="space-y-4">
                            <Card className="border shadow-sm border-t-4 border-t-emerald-600">
                                <CardHeader>
                                    <CardTitle className="text-base font-semibold">Risk by High School District</CardTitle>
                                    <CardDescription>Regional analysis of student failure rates</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className={chartContainerClass}>
                                        {correlationData?.by_district ? (
                                            <SciBarChart
                                                data={correlationData.by_district.slice(0, 12)}
                                                xDataKey="district"
                                                yDataKeys={[
                                                    { key: 'avg_fcw_rate', label: 'Avg FCW Rate (%)', color: '#10B981' },
                                                    { key: 'avg_grade', label: 'Avg Grade %', color: '#F59E0B' }
                                                ]}
                                                xAxisLabel="District"
                                                yAxisLabel="Percentage"
                                                showLegend={true}
                                            />
                                        ) : (
                                            <div className="h-full flex items-center justify-center text-muted-foreground">
                                                Processing district data...
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="action" className="space-y-4">
                            <Card className="border shadow-sm">
                                <CardHeader>
                                    <CardTitle className="text-base font-semibold">Priority Student List</CardTitle>
                                    <CardDescription>Top students needing academic intervention</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <DataTable
                                        data={riskData?.at_risk_students || []}
                                        columns={studentColumns}
                                        itemsPerPage={8}
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
