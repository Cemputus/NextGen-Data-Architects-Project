/**
 * Dean Dashboard - Smooth, Clean UI
 */
import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, GraduationCap, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import GlobalFilterPanel from '../components/GlobalFilterPanel';
import ModernStatsCards from '../components/ModernStatsCards';
import RoleBasedCharts from '../components/RoleBasedCharts';
import ExportButtons from '../components/ExportButtons';
import { SciBarChart } from '../components/charts/EChartsComponents';
import { TableWrapper, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const DeanDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({});
  const [showWelcome, setShowWelcome] = useState(true);
  const [staffViewMode, setStaffViewMode] = useState('auto'); // 'auto' | 'custom'
  const [staffSections, setStaffSections] = useState({
    overview: true,
    byDepartment: true,
    list: true,
  });

  useEffect(() => {
    loadFacultyData();
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), 30000);
    return () => clearTimeout(timer);
  }, []);

  const lastName =
    (user?.last_name && user.last_name.toString().trim()) ||
    (user?.full_name && user.full_name.toString().trim().split(' ').slice(-1)[0]) ||
    user?.username ||
    '';

  const loadFacultyData = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/analytics/faculty', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: filters
      });
      setStats(response.data);
    } catch (err) {
      console.error('Error loading faculty data:', err);
    } finally {
      setLoading(false);
    }
  };

  const staffHasData = stats && typeof stats.total_staff === 'number' && stats.total_staff > 0;
  const staffByDept = Array.isArray(stats?.staff_by_department) ? stats.staff_by_department : [];
  const staffList = Array.isArray(stats?.staff_list) ? stats.staff_list : [];
  const staffHasByDept = staffByDept.length > 0;
  const staffHasList = staffList.length > 0;

  const autoStaffSections = {
    overview: staffHasData,
    byDepartment: staffHasByDept,
    list: staffHasList,
  };

  const activeStaffSections =
    staffViewMode === 'auto' ? autoStaffSections : staffSections;

  return (
    <div className="space-y-4">
      {/* Header with Export */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">Faculty Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {showWelcome && lastName
              ? `Welcome back ${lastName} 🤗!`
              : 'Faculty-wide analytics and insights'}
          </p>
        </div>
        <ExportButtons stats={stats} filters={filters} filename="faculty_dashboard" />
      </div>

      {/* Filters */}
      <GlobalFilterPanel onFilterChange={setFilters} />

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading faculty data...</p>
          </div>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <ModernStatsCards stats={stats} type="faculty" />

          {/* Main Analytics Tabs */}
          <Tabs defaultValue="overview" className="space-y-3">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 gap-1 p-1">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="students" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Students
              </TabsTrigger>
              <TabsTrigger value="academics" className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                Academics
              </TabsTrigger>
              <TabsTrigger value="finance" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Finance
              </TabsTrigger>
              <TabsTrigger value="staff" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Staff & Lecturers
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-3">
              <Card className="border shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base font-semibold">Faculty Overview</CardTitle>
                  <CardDescription className="text-xs">Key metrics and trends</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <RoleBasedCharts filters={filters} type="faculty" />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="students" className="space-y-3">
              <Card className="border shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base font-semibold">Student Analytics</CardTitle>
                  <CardDescription className="text-xs">Student enrollment, distribution, and performance metrics</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <RoleBasedCharts filters={filters} type="faculty" />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="academics" className="space-y-3">
              <Card className="border shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base font-semibold">Academic Performance</CardTitle>
                  <CardDescription className="text-xs">Grades, courses, and academic achievements</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="min-h-[200px] max-h-[320px] flex items-center justify-center text-muted-foreground text-sm">
                    Academic performance charts
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="finance" className="space-y-3">
              <Card className="border shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base font-semibold">Financial Overview</CardTitle>
                  <CardDescription className="text-xs">Revenue, payments, and financial metrics</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="min-h-[200px] max-h-[320px] flex items-center justify-center text-muted-foreground text-sm">
                    Financial analytics charts
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="staff" className="space-y-3">
              <Card className="border shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-base font-semibold">Staff & Lecturers</CardTitle>
                      <CardDescription className="text-xs">
                        Staff and lecturer distribution for your faculty only
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">View mode:</span>
                      <div className="inline-flex rounded-md border border-border bg-muted/40 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setStaffViewMode('auto')}
                          className={`px-2 py-1 text-xs ${
                            staffViewMode === 'auto'
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          Auto
                        </button>
                        <button
                          type="button"
                          onClick={() => setStaffViewMode('custom')}
                          className={`px-2 py-1 text-xs ${
                            staffViewMode === 'custom'
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          Custom
                        </button>
                      </div>
                    </div>
                  </div>
                  {staffViewMode === 'custom' && (
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="checkbox"
                          className="h-3 w-3"
                          checked={activeStaffSections.overview}
                          onChange={(e) =>
                            setStaffSections((prev) => ({
                              ...prev,
                              overview: e.target.checked,
                            }))
                          }
                        />
                        Overview
                      </label>
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="checkbox"
                          className="h-3 w-3"
                          checked={activeStaffSections.byDepartment}
                          onChange={(e) =>
                            setStaffSections((prev) => ({
                              ...prev,
                              byDepartment: e.target.checked,
                            }))
                          }
                        />
                        By department
                      </label>
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="checkbox"
                          className="h-3 w-3"
                          checked={activeStaffSections.list}
                          onChange={(e) =>
                            setStaffSections((prev) => ({
                              ...prev,
                              list: e.target.checked,
                            }))
                          }
                        />
                        Staff list
                      </label>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  {activeStaffSections.overview && staffHasData && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-lg border border-border bg-muted/40 p-3">
                        <div className="text-xs text-muted-foreground">Total staff</div>
                        <div className="mt-1 text-lg font-semibold text-foreground">
                          {stats.total_staff}
                        </div>
                      </div>
                      <div className="rounded-lg border border-border bg-muted/40 p-3">
                        <div className="text-xs text-muted-foreground">Departments with staff</div>
                        <div className="mt-1 text-lg font-semibold text-foreground">
                          {staffByDept.length}
                        </div>
                      </div>
                      <div className="rounded-lg border border-border bg-muted/40 p-3">
                        <div className="text-xs text-muted-foreground">Sample listed staff</div>
                        <div className="mt-1 text-lg font-semibold text-foreground">
                          {Math.min(staffList.length, 200)}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeStaffSections.byDepartment && staffHasByDept && (
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">
                        Staff distribution by department
                      </div>
                      <div
                        className="min-h-[200px] max-h-[320px]"
                        data-chart-title="Staff by Department"
                        data-chart-container="true"
                      >
                        <SciBarChart
                          data={staffByDept}
                          xDataKey="department"
                          yDataKey="staff_count"
                          xAxisLabel="Department"
                          yAxisLabel="Number of staff"
                          fillColor="#4F46E5"
                          showLegend={false}
                          showGrid={true}
                        />
                      </div>
                    </div>
                  )}

                  {activeStaffSections.list && staffHasList && (
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">
                        Staff and lecturers (sample, max 200)
                      </div>
                      <TableWrapper className="max-h-[320px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Department</TableHead>
                              <TableHead>Role</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {staffList.map((staff) => (
                              <TableRow key={staff.employee_id}>
                                <TableCell>{staff.full_name}</TableCell>
                                <TableCell>{staff.department}</TableCell>
                                <TableCell>{staff.contract_type}</TableCell>
                                <TableCell>{staff.status}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableWrapper>
                    </div>
                  )}

                  {!staffHasData && (
                    <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                      No staff data available for your faculty. Try re-running ETL or check data sources.
                    </div>
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

export default DeanDashboard;
