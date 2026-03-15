/**
 * FEX Analytics Page - Modern UI with Data Loading
 * Comprehensive FEX analysis with drilldown capabilities
 */
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingDown, AlertTriangle, FileText, Download, BarChart3, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import ExportButtons from '../components/ExportButtons';
import axios from 'axios';
import { SciBarChart, UCU_COLORS } from '../components/charts/EChartsComponents';
import { TableWrapper, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
import { EmptyState } from '../components/ui/state-messages';
import { Loader2 } from 'lucide-react';
import { loadPageState, savePageState, loadDrilldown, saveDrilldown } from '../utils/statePersistence';

import { useNavigate } from 'react-router-dom';
import { PageHeader, PageContent } from '../components/ui/page-header';
import GlobalFilterPanel from '../components/GlobalFilterPanel';
import { useAuth } from '../context/AuthContext';
import { CHART_PALETTE } from '../config/designTokens';
import { AlertBanner } from '../components/ui/alert-banner';
import { Skeleton } from '../components/ui/skeleton';

const FEXAnalytics = ({ filters: externalFilters, onFilterChange: externalOnFilterChange }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [fexData, setFexData] = useState(null);

  const savedState = loadPageState('fex_analytics', { filters: {}, drilldown: 'overall', tab: 'distribution' });
  const [drilldown, setDrilldown] = useState(savedState.drilldown || 'overall');
  const [internalFilters, setInternalFilters] = useState(savedState.filters || {});
  const [activeTab, setActiveTab] = useState(savedState.tab || 'distribution');

  const filters = externalFilters != null ? externalFilters : internalFilters;
  const isControlled = externalFilters != null;

  useEffect(() => {
    if (!isControlled) savePageState('fex_analytics', { filters: internalFilters, drilldown, tab: activeTab });
  }, [isControlled, internalFilters, drilldown, activeTab]);

  useEffect(() => {
    loadFEXData();
  }, [filters, drilldown]);

  const loadFEXData = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/analytics/fex', {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
        params: { ...filters, drilldown }
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
      if (!fexData) {
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
  const chartContainerClass = "min-h-[200px] max-h-[320px] w-full";

  const rolePrefix = user?.role?.toLowerCase() === 'sysadmin' ? 'admin' : user?.role?.toLowerCase() || 'dashboard';

  return (
    <PageContent>
      <PageHeader
        title="FEX Analytics"
        description="Deep dive into failed exams and performance bottlenecks"
        actions={
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <Select
              value={drilldown}
              onChange={(e) => {
                const newDrilldown = e.target.value;
                setDrilldown(newDrilldown);
                saveDrilldown('fex_analytics', newDrilldown);
              }}
              className="w-full sm:w-48 h-9"
            >
              <option value="overall">Overall</option>
              <option value="faculty">By Faculty</option>
              <option value="department">By Department</option>
              <option value="program">By Program</option>
              <option value="course">By Course</option>
            </Select>
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
        <GlobalFilterPanel
          onFilterChange={setInternalFilters}
          pageName="fex_analytics"
        />
      )}

      <AlertBanner variant="info" title="FEX data by drilldown" className="mb-4">
        Select Overall or by Faculty, Department, Program, or Course. Metrics update with your filter selection.
      </AlertBanner>

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
              FEX distribution (chart rebuild in progress)
            </CardTitle>
            <CardDescription className="text-xs">
              KPI cards were removed to avoid duplicate KPI sections. Use the drilldown selector above.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className={chartContainerClass} data-chart-title={`FEX Distribution by ${drilldown}`} data-chart-container="true">
              {chartData.length > 0 ? (
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
              ) : (
                <EmptyState
                  icon={FileText}
                  message="No data available"
                  hint={fexData?.debug_info?.message || 'Try adjusting your drilldown or check if data exists.'}
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
