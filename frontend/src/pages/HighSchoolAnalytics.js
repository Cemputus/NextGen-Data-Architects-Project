/**
 * High School Analytics Page
 * Placeholder for rebuilt analytics (enrollment, retention, performance by school/district).
 * KPI cards and chart tabs removed; single chart placeholder + drilldown selector only.
 */
import React, { useState } from 'react';
import { School } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import ExportButtons from '../components/ExportButtons';

const DRILLDOWN_OPTIONS = [
  { value: 'school', label: 'By High School' },
  { value: 'district', label: 'By District' },
  { value: 'overall', label: 'Overall' },
];

const HighSchoolAnalytics = () => {
  const [drilldown, setDrilldown] = useState('school');

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">High School Analytics</h1>
          <p className="text-sm text-muted-foreground">Enrollment, retention, and performance by feeder school (new analytics coming soon)</p>
        </div>
        <ExportButtons filename="high_school_analytics" />
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="p-4 pb-2 flex flex-row flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base font-semibold">High School Analytics (placeholder)</CardTitle>
            <CardDescription className="text-xs">Chart and KPIs will be rebuilt for current/previous semester focus.</CardDescription>
          </div>
          <select
            value={drilldown}
            onChange={(e) => setDrilldown(e.target.value)}
            className="h-9 min-w-[140px] rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            {DRILLDOWN_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="min-h-[200px] max-h-[320px] w-full flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
            <div className="text-center p-6">
              <School className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="font-medium">Chart placeholder</p>
              <p className="text-xs mt-1">Drilldown: {DRILLDOWN_OPTIONS.find((o) => o.value === drilldown)?.label ?? drilldown}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HighSchoolAnalytics;
