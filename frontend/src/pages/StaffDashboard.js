/**
 * Staff Dashboard - Smooth, Clean UI
 */
import React, { useState, useEffect } from 'react';
import { GraduationCap, Users, BookOpen, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import GlobalFilterPanel from '../components/GlobalFilterPanel';
import ModernStatsCards from '../components/ModernStatsCards';
import RoleBasedCharts from '../components/RoleBasedCharts';
import ExportButtons from '../components/ExportButtons';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

const StaffDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [stats, setStats] = useState(null);

  useEffect(() => {
    loadStaffData();
  }, []);

  const loadStaffData = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/analytics/staff/classes', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setClasses(response.data.classes || []);
      setStats(response.data.stats || null);
    } catch (err) {
      console.error('Error loading staff data:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Export */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Dashboard</h1>
          <p className="text-muted-foreground">Class management and teaching analytics</p>
        </div>
        <ExportButtons stats={stats} filters={filters} filename="staff_dashboard" />
      </div>

      {/* Filters */}
      <GlobalFilterPanel onFilterChange={setFilters} />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-muted-foreground">Loading staff data...</p>
          </div>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          {stats && <ModernStatsCards stats={stats} type="general" />}

          {/* Main Content */}
          <Tabs defaultValue="classes" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="classes" className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                My Classes
              </TabsTrigger>
              <TabsTrigger value="students" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Students
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Analytics
              </TabsTrigger>
            </TabsList>

            <TabsContent value="classes" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>My Classes</CardTitle>
                  <CardDescription>Manage your assigned courses and classes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {classes.length > 0 ? (
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {classes.map((cls, idx) => (
                          <Card key={idx} className="cursor-pointer hover:shadow-md transition-shadow">
                            <CardHeader>
                              <CardTitle className="text-lg">{cls.course_name || `Class ${idx + 1}`}</CardTitle>
                              <CardDescription>{cls.course_code || 'N/A'}</CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="text-sm text-muted-foreground">
                                <p>Students: {cls.student_count || 0}</p>
                                <p>Schedule: {cls.schedule || 'TBA'}</p>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="h-64 flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
                        <div className="text-center">
                          <GraduationCap className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                          <p>No classes assigned</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="students" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Student Management</CardTitle>
                  <CardDescription>Search and manage students in your classes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 mb-4">
                    <Input
                      placeholder="Search students..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="flex-1"
                    />
                    <Button>
                      <Search className="h-4 w-4 mr-2" />
                      Search
                    </Button>
                  </div>
                  <div className="h-64 flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
                    Student list and management tools
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Teaching Analytics</CardTitle>
                  <CardDescription>Performance metrics and class statistics</CardDescription>
                </CardHeader>
                <CardContent>
                  <RoleBasedCharts filters={filters} type="staff" />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default StaffDashboard;
