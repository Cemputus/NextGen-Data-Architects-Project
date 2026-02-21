/**
 * High School Analytics Page
 * Analysis of high school performance, enrollment, retention, graduation rates
 */
import React, { useState, useEffect } from 'react';
import { TrendingUp, School, Users, GraduationCap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import GlobalFilterPanel from '../components/GlobalFilterPanel';
import ExportButtons from '../components/ExportButtons';
import { KPICard } from '../components/ui/kpi-card';
import { DashboardGrid } from '../components/ui/dashboard-grid';
import axios from 'axios';
import { SciBarChart, SciLineChart, UCU_COLORS } from '../components/charts/EChartsComponents';
import { Loader2 } from 'lucide-react';
import { loadPageState, savePageState } from '../utils/statePersistence';

const HighSchoolAnalytics = ({ filters: externalFilters, onFilterChange: externalOnFilterChange }) => {
  const [loading, setLoading] = useState(true);
  const [hsData, setHsData] = useState(null);
  
  const savedState = loadPageState('high_school_analytics', { filters: {}, tab: 'enrollment' });
  const [internalFilters, setInternalFilters] = useState(savedState.filters || {});
  const [activeTab, setActiveTab] = useState(savedState.tab || 'enrollment');

  const filters = externalFilters != null ? externalFilters : internalFilters;
  const isControlled = externalFilters != null;

  useEffect(() => {
    loadHighSchoolData();
  }, [filters]);

  useEffect(() => {
    if (!isControlled) savePageState('high_school_analytics', { filters: internalFilters, tab: activeTab });
  }, [isControlled, internalFilters, activeTab]);

  const loadHighSchoolData = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/analytics/high-school', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: filters
      });

      if (response.data.error) {
        console.error('API returned error:', response.data.error);
        if (response.data.debug_info) {
          console.error('Debug info:', response.data.debug_info);
        }
      }

      setHsData(response.data);
    } catch (err) {
      console.error('Error loading high school data:', err);
      console.error('Error details:', err.response?.data || err.message);
      setHsData({ 
        data: [], 
        summary: { 
          total_high_schools: 0, 
          total_students: 0, 
          avg_retention_rate: 0, 
          avg_graduation_rate: 0 
        },
        error: err.response?.data?.error || err.message
      });
    } finally {
      setLoading(false);
    }
  };

  const chartData = hsData?.data || [];
  const summary = hsData?.summary || {
    total_high_schools: 0,
    total_students: 0,
    avg_retention_rate: 0,
    avg_graduation_rate: 0
  };

  const chartContainerClass = "min-h-[200px] max-h-[320px] w-full";
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">High School Analytics</h1>
          <p className="text-sm text-muted-foreground">Enrollment, Retention, Graduation, and Performance Analysis</p>
        </div>
        <ExportButtons 
          data={hsData?.data} 
          filters={filters} 
          filename="high_school_analytics"
          stats={summary}
          chartSelectors={[
            '.recharts-wrapper',
            '[class*="chart"]',
            '[data-chart]'
          ]}
        />
      </div>

      {!isControlled && (
        <GlobalFilterPanel onFilterChange={setInternalFilters} pageName="high_school_analytics" />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading high school analytics...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Summary KPI Cards */}
          <DashboardGrid cols={{ default: 2, sm: 2, md: 4 }}>
            <KPICard
              title="Total High Schools"
              value={summary.total_high_schools || 0}
              icon={School}
              subtitle="High schools"
            />
            <KPICard
              title="Total Students"
              value={summary.total_students || 0}
              icon={Users}
              subtitle="Students from high schools"
            />
            <KPICard
              title="Avg Retention Rate"
              value={`${summary.avg_retention_rate || 0}%`}
              icon={TrendingUp}
              subtitle="Average retention"
              changeType={summary.avg_retention_rate > 80 ? 'positive' : summary.avg_retention_rate > 60 ? 'neutral' : 'negative'}
            />
            <KPICard
              title="Avg Graduation Rate"
              value={`${summary.avg_graduation_rate || 0}%`}
              icon={GraduationCap}
              subtitle="Average graduation"
              changeType={summary.avg_graduation_rate > 80 ? 'positive' : summary.avg_graduation_rate > 60 ? 'neutral' : 'negative'}
            />
          </DashboardGrid>

          {/* Charts */}
          <Tabs value={activeTab} onValueChange={(value) => {
            setActiveTab(value);
            savePageState('high_school_analytics', { filters, tab: value });
          }} className="space-y-3">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1 p-1">
              <TabsTrigger value="enrollment" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Enrollment
              </TabsTrigger>
              <TabsTrigger value="retention" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Retention & Graduation
              </TabsTrigger>
              <TabsTrigger value="performance" className="flex items-center gap-2">
                <School className="h-4 w-4" />
                Performance
              </TabsTrigger>
              <TabsTrigger value="programs" className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                Programs
              </TabsTrigger>
              <TabsTrigger value="tuition" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Tuition
              </TabsTrigger>
            </TabsList>

            <TabsContent value="enrollment" className="space-y-3">
              <Card className="border shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base font-semibold text-blue-700">Enrollment by High School</CardTitle>
                  <CardDescription className="text-xs">Student enrollment distribution across high schools</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className={chartContainerClass} data-chart-title="Enrollment by High School" data-chart-container="true">
                    {chartData.length > 0 ? (
                      <SciBarChart
                        data={chartData.slice(0, 20)}
                        xDataKey="high_school"
                        yDataKeys={[
                          { key: 'total_students', label: 'Total Students', color: '#3182CE' },
                          { key: 'enrolled_students', label: 'Enrolled', color: '#38A169' }
                        ]}
                        xAxisLabel="High School"
                        yAxisLabel="Number of Students"
                        showLegend={true}
                        showGrid={true}
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
                        <div className="text-center p-6">
                          <p className="text-lg font-medium">No data available</p>
                          <p className="text-sm mt-2">
                            {hsData?.error ? (
                              `Error: ${hsData.error}`
                            ) : hsData?.debug_info?.message ? (
                              hsData.debug_info.message
                            ) : (
                              'Try adjusting your filters or check if data exists.'
                            )}
                          </p>
                          {hsData?.debug_info && (
                            <div className="mt-4 text-xs text-gray-500 space-y-1">
                              <p>High schools in database: {hsData.debug_info.total_high_schools_in_db || 0}</p>
                              {hsData.debug_info.filters_applied && Object.keys(hsData.debug_info.filters_applied).length > 0 && (
                                <p>Active filters: {Object.keys(hsData.debug_info.filters_applied).join(', ')}</p>
                              )}
                              {hsData.debug_info.where_clauses_count > 0 && (
                                <p>Filter conditions applied: {hsData.debug_info.where_clauses_count}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="retention" className="space-y-3">
              <Card className="border shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base font-semibold text-green-700">Retention & Graduation Rates</CardTitle>
                  <CardDescription className="text-xs">Retention, graduation, and dropout rates by high school</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className={chartContainerClass} data-chart-title="Retention & Graduation Rates" data-chart-container="true">
                    <SciLineChart
                      data={chartData.slice(0, 20)}
                      xDataKey="high_school"
                      yDataKey="retention_rate"
                      xAxisLabel="High School"
                      yAxisLabel="Rate (%)"
                      strokeColor="#10B981"
                      strokeWidth={3}
                      showLegend={true}
                      showGrid={true}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="performance" className="space-y-3">
              <Card className="border shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base font-semibold text-purple-700">Performance Analysis</CardTitle>
                  <CardDescription className="text-xs">Academic performance metrics by high school</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="min-h-[200px] max-h-[280px] flex items-center justify-center text-muted-foreground text-sm border border-dashed rounded-lg">
                    <div className="text-center">
                      <School className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p>Performance analysis charts</p>
                      <p className="text-sm mt-2">Coming soon</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="programs" className="space-y-3">
              <Card className="border shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base font-semibold text-orange-700">Program Distribution</CardTitle>
                  <CardDescription className="text-xs">Program distribution by high school</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="min-h-[200px] max-h-[280px] flex items-center justify-center text-muted-foreground text-sm border border-dashed rounded-lg">
                    <div className="text-center">
                      <GraduationCap className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p>Program distribution charts</p>
                      <p className="text-sm mt-2">Coming soon</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tuition" className="space-y-3">
              <Card className="border shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base font-semibold text-yellow-700">Tuition Completion Rates</CardTitle>
                  <CardDescription className="text-xs">Tuition completion rates by high school</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className={chartContainerClass} data-chart-title="Tuition / Performance" data-chart-container="true">
                    <SciBarChart
                      data={chartData.slice(0, 20)}
                      xDataKey="high_school"
                      yDataKeys={[
                        { key: 'avg_grade', label: 'Average Grade', color: '#8b5cf6' },
                        { key: 'total_fex', label: 'FEX Count', color: '#ef4444' },
                        { key: 'total_mex', label: 'MEX Count', color: '#f59e0b' }
                      ]}
                      xAxisLabel="High School"
                      yAxisLabel="Count / Grade"
                      showLegend={true}
                      showGrid={true}
                    />
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

export default HighSchoolAnalytics;
