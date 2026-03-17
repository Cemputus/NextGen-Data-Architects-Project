import React, { useEffect, useMemo, useState } from 'react';
import { MapPin, Users } from 'lucide-react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { AlertBanner } from '../components/ui/alert-banner';
import { DataTable } from '../components/shared/DataTable';
import ExportButtons from '../components/ExportButtons';
import { SkeletonTable } from '../components/ui/skeleton';

const RecruitmentAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState({ total_students: 0, schools_represented: 0, district_coverage: 0 });
  const [topSchools, setTopSchools] = useState([]);
  const [byDistrict, setByDistrict] = useState([]);
  const [performanceBySchool, setPerformanceBySchool] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await axios.get('/api/analytics/recruitment', {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
        });
        setSummary(res.data?.summary || {});
        setTopSchools(res.data?.top_schools || []);
        setByDistrict(res.data?.by_district || []);
        setPerformanceBySchool(res.data?.performance_by_school || []);
      } catch (err) {
        console.error('Error loading recruitment analytics:', err);
        setError(err.response?.data?.error || 'Failed to load recruitment analytics.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const feederColumns = useMemo(
    () => [
      { key: 'school', header: 'High School' },
      { key: 'district', header: 'District' },
      { key: 'student_count', header: 'Students' },
    ],
    []
  );

  const districtColumns = useMemo(
    () => [
      { key: 'district', header: 'District' },
      { key: 'student_count', header: 'Students' },
    ],
    []
  );

  const performanceColumns = useMemo(
    () => [
      { key: 'school', header: 'High School' },
      { key: 'district', header: 'District' },
      { key: 'avg_gpa', header: 'Avg GPA', render: (v) => (v ?? 0).toFixed(2) },
      { key: 'fcw_rate', header: 'FCW Rate', render: (v) => `${((v ?? 0) * 100).toFixed(1)}%` },
      { key: 'mex_rate', header: 'MEX Rate', render: (v) => `${((v ?? 0) * 100).toFixed(1)}%` },
      { key: 'fex_rate', header: 'FEX Rate', render: (v) => `${((v ?? 0) * 100).toFixed(1)}%` },
    ],
    []
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">Recruitment &amp; Feeder-School Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Feeder schools, district coverage, and academic risk profile by school to guide recruitment and outreach strategy.
          </p>
        </div>
        <ExportButtons
          filename="recruitment_analytics_summary"
          data={topSchools}
          filters={{}}
        />
      </div>

      <AlertBanner variant="info" title="Institution-wide recruitment intelligence">
        These views focus on enrolled students and their previous high schools. Use faculty/department filters where available
        to narrow the story to your scope.
      </AlertBanner>

      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border shadow-sm">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-sm font-semibold">Total Students from High Schools</CardTitle>
            <CardDescription className="text-xs">Students linked to a known feeder school.</CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <p className="text-2xl font-bold">{summary?.total_students ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-sm font-semibold">Schools Represented</CardTitle>
            <CardDescription className="text-xs">Number of distinct feeder schools.</CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <p className="text-2xl font-bold">{summary?.schools_represented ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-sm font-semibold">District Coverage</CardTitle>
            <CardDescription className="text-xs">Distinct districts represented by students.</CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <p className="text-2xl font-bold">{summary?.district_coverage ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-2 flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold">Top Feeder Schools</CardTitle>
              <CardDescription className="text-xs">
                Schools sending the highest number of students into the institution.
              </CardDescription>
            </div>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {error && (
              <div className="mb-3 text-sm text-destructive">
                {error}
              </div>
            )}
            {loading ? (
              <SkeletonTable rows={6} cols={feederColumns.length} />
            ) : (
              <DataTable
                data={topSchools}
                columns={feederColumns}
                itemsPerPage={10}
                searchable
                searchPlaceholder="Search schools..."
              />
            )}
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-2 flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold">Recruitment by District</CardTitle>
              <CardDescription className="text-xs">
                Geographic distribution of students by high school district.
              </CardDescription>
            </div>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {error && (
              <div className="mb-3 text-sm text-destructive">
                {error}
              </div>
            )}
            {loading ? (
              <SkeletonTable rows={6} cols={districtColumns.length} />
            ) : (
              <DataTable
                data={byDistrict}
                columns={districtColumns}
                itemsPerPage={10}
                searchable
                searchPlaceholder="Search districts..."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base font-semibold">Performance &amp; Risk by School</CardTitle>
          <CardDescription className="text-xs">
            Average GPA and FCW/MEX/FEX rates by feeder school to identify strong and high-risk sources.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {error && (
            <div className="mb-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {loading ? (
            <SkeletonTable rows={6} cols={performanceColumns.length} />
          ) : (
            <DataTable
              data={performanceBySchool}
              columns={performanceColumns}
              itemsPerPage={10}
              searchable
              searchPlaceholder="Search schools..."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RecruitmentAnalytics;

