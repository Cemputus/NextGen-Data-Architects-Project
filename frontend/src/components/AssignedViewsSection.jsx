/**
 * Displays visualizations assigned to the current user (by role or by username).
 * Used on role dashboards so users see "Views shared with you" from analysts.
 */
import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { SciBarChart, SciLineChart, SciAreaChart, SciDonutChart } from './charts/EChartsComponents';
import { Loader2, BarChart3 } from 'lucide-react';

function buildChartData(snapshot, xColumn, yColumn) {
  if (!snapshot?.rows?.length || !xColumn || !yColumn) return [];
  return snapshot.rows.map((row, index) => {
    const rawVal = row[yColumn];
    const numVal = Number(rawVal);
    return {
      category: row[xColumn] ?? `Row ${index + 1}`,
      value: Number.isFinite(numVal) ? numVal : 0,
    };
  }).slice(0, 500);
}

export function VizCard({ viz, chartHeight = 220 }) {
  const snapshot = viz.resultSnapshot || {};
  const chartData = useMemo(
    () => buildChartData(snapshot, viz.xColumn, viz.yColumn),
    [snapshot, viz.xColumn, viz.yColumn]
  );
  const chartType = (viz.chartType || 'bar').toLowerCase();
  const chartContainerStyle = typeof chartHeight === 'number' ? { height: chartHeight } : undefined;
  const chartContainerClass = typeof chartHeight === 'number' ? 'w-full' : 'h-[220px] w-full';

  if (!chartData.length) {
    return (
      <Card className="border shadow-sm overflow-hidden">
        <CardHeader className="p-3 pb-1">
          <CardTitle className="text-sm font-semibold">{viz.title}</CardTitle>
          <CardDescription className="text-xs">
            Shared by {viz.createdByUsername} · No data to display
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border shadow-sm overflow-hidden">
      <CardHeader className="p-3 pb-1">
        <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          {viz.title}
        </CardTitle>
        <CardDescription className="text-xs">
          Shared by {viz.createdByUsername}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <div className={chartContainerClass} style={chartContainerStyle}>
          {chartType === 'bar' && (
            <SciBarChart
              data={chartData}
              xDataKey="category"
              yDataKey="value"
              xAxisLabel={viz.xColumn}
              yAxisLabel={viz.yColumn}
            />
          )}
          {chartType === 'line' && (
            <SciLineChart
              data={chartData}
              xDataKey="category"
              yDataKey="value"
              xAxisLabel={viz.xColumn}
              yAxisLabel={viz.yColumn}
            />
          )}
          {chartType === 'area' && (
            <SciAreaChart
              data={chartData}
              xDataKey="category"
              yDataKey="value"
              xAxisLabel={viz.xColumn}
              yAxisLabel={viz.yColumn}
            />
          )}
          {chartType === 'pie' && (
            <SciDonutChart
              data={chartData}
              nameKey="category"
              valueKey="value"
              title={viz.title}
            />
          )}
          {!['bar', 'line', 'area', 'pie'].includes(chartType) && (
            <SciBarChart
              data={chartData}
              xDataKey="category"
              yDataKey="value"
              xAxisLabel={viz.xColumn}
              yAxisLabel={viz.yColumn}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AssignedViewsSection() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get('/api/query/assigned-visualizations/for-me', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
      .then((res) => setList(res.data?.visualizations || []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="border shadow-sm">
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (list.length === 0) return null;

  return (
    <Card className="border shadow-sm">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base font-semibold">Views shared with you</CardTitle>
        <CardDescription className="text-xs">
          Visualizations assigned to your role or to you by an analyst.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((viz) => (
            <VizCard key={viz.id} viz={viz} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
