/**
 * Student Grades Page - Independent page for viewing grades
 */
import React, { useState, useEffect } from 'react';
import { GraduationCap, Award, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import RoleBasedCharts from '../components/RoleBasedCharts';
import ExportButtons from '../components/ExportButtons';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

const StudentGrades = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [grades, setGrades] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    loadGrades();
  }, []);

  const loadGrades = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/analytics/student', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: { access_number: user?.access_number || user?.username }
      });
      setStats(response.data);
      setGrades(response.data.grade_distribution || []);
    } catch (err) {
      console.error('Error loading grades:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">My Grades</h1>
          <p className="text-sm text-muted-foreground">View your academic performance and grades</p>
        </div>
        <ExportButtons stats={stats} filename="student_grades" />
      </div>

      <Tabs defaultValue="overview" className="space-y-3">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 gap-1 p-1">
          <TabsTrigger value="overview">
            <Award className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="distribution">
            <GraduationCap className="h-4 w-4 mr-2" />
            Grade Distribution
          </TabsTrigger>
          <TabsTrigger value="trends">
            <TrendingUp className="h-4 w-4 mr-2" />
            Trends
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Average Grade</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {stats?.avg_grade?.toFixed(2) || 'N/A'}%
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Total Courses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {stats?.total_courses || 0}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Completed Exams</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">
                  {stats?.completed_exams || 0}
                </div>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Grade Breakdown</CardTitle>
              <CardDescription>Your performance across all courses</CardDescription>
            </CardHeader>
            <CardContent>
              <RoleBasedCharts filters={{}} type="student" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Grade Distribution</CardTitle>
              <CardDescription>Distribution of your letter grades</CardDescription>
            </CardHeader>
            <CardContent>
              {grades.length > 0 ? (
                <div className="space-y-4">
                  {grades.map((grade, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 border rounded-lg">
                      <span className="font-semibold">{grade.letter_grade}</span>
                      <span className="text-muted-foreground">{grade.count} courses</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No grade data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Grade Trends</CardTitle>
              <CardDescription>Your academic performance over time</CardDescription>
            </CardHeader>
            <CardContent>
              <RoleBasedCharts filters={{}} type="student" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentGrades;






