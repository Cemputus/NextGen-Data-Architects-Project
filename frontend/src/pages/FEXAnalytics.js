/**
 * FEX Analytics Page - Modern UI with Data Loading
 * Comprehensive FEX analysis with drilldown capabilities
 */
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingDown, AlertTriangle, FileText, Download, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { KPICard } from '../components/ui/kpi-card';
import { DashboardGrid } from '../components/ui/dashboard-grid';
import GlobalFilterPanel from '../components/GlobalFilterPanel';
import ExportButtons from '../components/ExportButtons';
import axios from 'axios';
import { SciBarChart, UCU_COLORS } from '../components/charts/EChartsComponents';
import { TableWrapper, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
import { EmptyState } from '../components/ui/state-messages';
import { Loader2 } from 'lucide-react';
import { loadPageState, savePageState, loadDrilldown, saveDrilldown } from '../utils/statePersistence';

const FEXAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [fexData, setFexData] = useState(null);
  
  // Load persisted state on mount
  const savedState = loadPageState('fex_analytics', { filters: {}, drilldown: 'overall', tab: 'distribution' });
  const [drilldown, setDrilldown] = useState(savedState.drilldown || 'overall');
  const [filters, setFilters] = useState(savedState.filters || {});
  const [activeTab, setActiveTab] = useState(savedState.tab || 'distribution');

  // Save state whenever it changes
  useEffect(() => {
    savePageState('fex_analytics', { filters, drilldown, tab: activeTab });
  }, [filters, drilldown, activeTab]);

  useEffect(() => {
    loadFEXData();
  }, [filters, drilldown]);

  const loadFEXData = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/analytics/fex', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: { ...filters, drilldown }
      });
      
      // Ensure we have valid data structure
      if (response.data && response.data.data) {
        setFexData(response.data);
      } else if (response.data && Array.isArray(response.data)) {
        // Handle case where API returns array directly
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
      // Don't set empty data on error, keep previous data or show error
      if (!fexData) {
        setFexData({ data: [], summary: { total_fex: 0, total_mex: 0, total_fcw: 0, total_completed: 0, fex_rate: 0 } });
      }
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#ef4444', '#f59e0b', '#8b5cf6', '#3b82f6', '#10b981', '#06b6d4'];

  // Prepare chart data
  const chartData = fexData?.data || [];
  const getDataKey = () => {
    if (drilldown === 'faculty') return 'faculty_name';
    if (drilldown === 'department') return 'department';
    if (drilldown === 'program') return 'program_name';
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

  const chartContainerClass = "min-h-[200px] max-h-[320px] w-full";
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">FEX Analytics</h1>
          <p className="text-sm text-muted-foreground">Failed Exam Analysis with Drilldown Capabilities</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          <Select
            value={drilldown}
            onChange={(e) => {
              const newDrilldown = e.target.value;
              setDrilldown(newDrilldown);
              saveDrilldown('fex_analytics', newDrilldown);
            }}
            className="w-full sm:w-48"
          >
            <option value="overall">Overall</option>
            <option value="faculty">By Faculty</option>
            <option value="department">By Department</option>
            <option value="program">By Program</option>
            <option value="course">By Course</option>
          </Select>
          <ExportButtons 
            data={fexData?.data} 
            filters={{ ...filters, drilldown }} 
            filename="fex_analytics"
            stats={summary}
            chartSelectors={[
              '.recharts-wrapper', // All recharts components
              '[class*="chart"]',
              '[data-chart]'
            ]}
          />
        </div>
      </div>

      {/* Global Filter Panel */}
      <GlobalFilterPanel onFilterChange={setFilters} pageName="fex_analytics" />

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading FEX analytics...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Summary KPI Cards */}
          <DashboardGrid cols={{ default: 2, sm: 2, md: 4 }}>
            <KPICard
              title="Total FEX"
              value={summary.total_fex || 0}
              icon={AlertTriangle}
              subtitle="Failed exams"
              changeType={summary.total_fex > 0 ? 'negative' : 'neutral'}
            />
            <KPICard
              title="FEX Rate"
              value={`${summary.fex_rate || 0}%`}
              icon={TrendingDown}
              subtitle="Failure rate"
              changeType={summary.fex_rate > 10 ? 'negative' : summary.fex_rate > 5 ? 'neutral' : 'positive'}
            />
            <KPICard
              title="Total MEX"
              value={summary.total_mex || 0}
              icon={FileText}
              subtitle="Missed exams"
            />
            <KPICard
              title="Total FCW"
              value={summary.total_fcw || 0}
              icon={BarChart3}
              subtitle="Failed coursework"
            />
          </DashboardGrid>

          {/* Charts */}
          <Tabs value={activeTab} onValueChange={(value) => {
            setActiveTab(value);
            savePageState('fex_analytics', { filters, drilldown, tab: value });
          }} className="space-y-3">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-1 p-1">
              <TabsTrigger value="distribution" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Distribution
              </TabsTrigger>
              <TabsTrigger value="trends" className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                Trends
              </TabsTrigger>
              <TabsTrigger value="comparison" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Comparison
              </TabsTrigger>
              <TabsTrigger value="table" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Details
              </TabsTrigger>
            </TabsList>

            <TabsContent value="distribution" className="space-y-3">
              <Card className="border shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base font-semibold text-red-700">FEX Distribution</CardTitle>
                  <CardDescription className="text-xs">Failed exam distribution by {drilldown}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className={chartContainerClass} data-chart-title={`FEX Distribution by ${drilldown}`} data-chart-container="true">
                    <SciBarChart
                      data={chartData}
                      xDataKey={getDataKey()}
                      yDataKeys={[
                        { key: 'total_fex', label: 'FEX', color: '#ef4444' },
                        { key: 'total_mex', label: 'MEX', color: '#f59e0b' },
                        { key: 'total_fcw', label: 'FCW', color: '#8b5cf6' }
                      ]}
                      xAxisLabel={drilldown.charAt(0).toUpperCase() + drilldown.slice(1)}
                      yAxisLabel="Count"
                      showLegend={true}
                      showGrid={true}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="trends" className="space-y-3">
              <Card className="border shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base font-semibold text-orange-700">FEX Trends</CardTitle>
                  <CardDescription className="text-xs">Trend analysis over time</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="min-h-[200px] max-h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                    Trend analysis charts - Coming soon
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="comparison" className="space-y-3">
              <Card className="border shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base font-semibold text-purple-700">Comparison Analysis</CardTitle>
                  <CardDescription className="text-xs">Compare FEX rates across different dimensions</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="min-h-[200px] max-h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                    Comparison charts - Coming soon
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="table" className="space-y-3">
              <Card className="border shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base font-semibold text-blue-700">Detailed FEX Data</CardTitle>
                  <CardDescription className="text-xs">Complete breakdown of failed exams</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {chartData.length > 0 ? (
                    <TableWrapper>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Faculty/Department</TableHead>
                            <TableHead className="text-right">FEX</TableHead>
                            <TableHead className="text-right">MEX</TableHead>
                            <TableHead className="text-right">FCW</TableHead>
                            <TableHead className="text-right">Completed</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {chartData.slice(0, 20).map((row, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{row[getDataKey()] || 'N/A'}</TableCell>
                              <TableCell className="text-right text-red-600 font-semibold">{row.total_fex || 0}</TableCell>
                              <TableCell className="text-right text-orange-600">{row.total_mex || 0}</TableCell>
                              <TableCell className="text-right text-purple-600">{row.total_fcw || 0}</TableCell>
                              <TableCell className="text-right text-green-600">{row.total_completed || 0}</TableCell>
                              <TableCell className="text-right font-medium">{row.total_exams || 0}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableWrapper>
                  ) : (
                    <EmptyState
                      icon={FileText}
                      message="No data available"
                      hint={fexData?.debug_info?.message || 'Try adjusting your filters or check if data exists.'}
                      className="border-2 border-dashed rounded-lg"
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default FEXAnalytics;
