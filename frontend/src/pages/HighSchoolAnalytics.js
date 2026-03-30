
import React, { useState, useEffect, useMemo } from 'react';
import { School } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import ExportButtons from '../components/ExportButtons';
import { DataTable } from '../components/shared/DataTable';
import { SkeletonTable } from '../components/ui/skeleton';
import axios from 'axios';
import { exportTableToExcel } from '../utils/exportUtils';

const DRILLDOWN_OPTIONS = [
  { value: 'school', label: 'By High School' },
  { value: 'district', label: 'By District' },
];

const HighSchoolAnalytics = () => {
  const [drilldown, setDrilldown] = useState('school');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bySchool, setBySchool] = useState([]);
  const [byDistrict, setByDistrict] = useState([]);

  useEffect(() => {
    const loadData = async () => {
    try {
      setLoading(true);
        setError(null);
        const res = await axios.get('/api/analytics/high-school-risk-correlation', {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
        });
        setBySchool(res.data?.by_school || []);
        setByDistrict(res.data?.by_district || []);
    } catch (err) {
        console.error('Error loading high school analytics:', err);
        setError(err.response?.data?.error || 'Failed to load high school analytics.');
    } finally {
      setLoading(false);
    }
  };
    loadData();
  }, []);

  const currentRows = drilldown === 'district' ? byDistrict : bySchool;

  const columns = useMemo(() => {
    if (drilldown === 'district') {
      return [
        { key: 'district', header: 'District' },
        { key: 'avg_fcw_rate', header: 'Avg FCW Rate', render: (v) => `${(v ?? 0 * 100).toFixed(1)}%` },
        { key: 'avg_grade', header: 'Avg Grade', render: (v) => (v ?? 0).toFixed(1) },
      ];
    }
    return [
      { key: 'school', header: 'High School' },
      { key: 'district', header: 'District' },
      { key: 'fcw_rate', header: 'FCW Rate', render: (v) => `${((v ?? 0) * 100).toFixed(1)}%` },
      { key: 'mex_rate', header: 'MEX Rate', render: (v) => `${((v ?? 0) * 100).toFixed(1)}%` },
      { key: 'fex_rate', header: 'FEX Rate', render: (v) => `${((v ?? 0) * 100).toFixed(1)}%` },
      { key: 'avg_gpa', header: 'Avg Grade', render: (v) => (v ?? 0).toFixed(1) },
    ];
  }, [drilldown]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">High School Analytics</h1>
          <p className="text-sm text-muted-foreground">
            FCW/MEX/FEX incidence and average performance by feeder school and district.
          </p>
        </div>
        <ExportButtons
          filename="high_school_analytics"
          data={currentRows}
          filters={{ drilldown }}
        />
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="p-4 pb-2 flex flex-row flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base font-semibold">High School Risk &amp; Performance</CardTitle>
            <CardDescription className="text-xs">
              Higher FCW/MEX/FEX rates indicate higher academic risk from that school or district.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <School className="h-4 w-4 text-muted-foreground" />
            <select
              value={drilldown}
              onChange={(e) => setDrilldown(e.target.value)}
              className="h-9 min-w-[140px] rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              {DRILLDOWN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
        </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
          {error && (
            <div className="mb-4 text-sm text-destructive">
              {error}
                            </div>
                          )}
          {loading ? (
            <SkeletonTable rows={6} cols={columns.length} />
          ) : (
            <DataTable
              data={currentRows}
              columns={columns}
              itemsPerPage={10}
              searchable
              searchPlaceholder={drilldown === 'district' ? 'Search districts...' : 'Search schools...'}
              onExport={(rows) => exportTableToExcel(rows, columns, `high_school_${drilldown}`)}
            />
          )}
                </CardContent>
              </Card>
    </div>
  );
};

export default HighSchoolAnalytics;
