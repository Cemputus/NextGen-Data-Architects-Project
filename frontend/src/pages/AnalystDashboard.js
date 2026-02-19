/**
 * Analyst Dashboard - Smooth, Clean UI
 */
import React, { useState } from 'react';
import { BarChart3, TrendingUp, Filter, FileText, Plus, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import GlobalFilterPanel from '../components/GlobalFilterPanel';
import ExportButtons from '../components/ExportButtons';
import FEXAnalytics from './FEXAnalytics';
import HighSchoolAnalytics from './HighSchoolAnalytics';

const AnalystDashboard = () => {
  const [filters, setFilters] = useState({});

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Workspace</h1>
          <p className="text-muted-foreground">Create and modify analytics dashboards</p>
        </div>
        <div className="flex gap-2">
          <ExportButtons filename="analyst_workspace" />
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Dashboard
          </Button>
        </div>
      </div>

      {/* Filters */}
      <GlobalFilterPanel onFilterChange={setFilters} />

      {/* Main Analytics Tabs */}
      <Tabs defaultValue="fex" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="fex" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            FEX Analytics
          </TabsTrigger>
          <TabsTrigger value="highschool" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            High School
          </TabsTrigger>
          <TabsTrigger value="custom" className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Custom
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fex" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Failed Exam (FEX) Analytics</CardTitle>
              <CardDescription>Analyze student performance and identify at-risk students</CardDescription>
            </CardHeader>
            <CardContent>
              <FEXAnalytics />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="highschool" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>High School Analytics</CardTitle>
              <CardDescription>Track student performance by high school and district</CardDescription>
            </CardHeader>
            <CardContent>
              <HighSchoolAnalytics />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Custom Analytics Builder</CardTitle>
              <CardDescription>Create custom analytics dashboards</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-96 flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p>Custom analytics builder coming soon</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Saved Reports</CardTitle>
              <CardDescription>Access and manage your saved analytics reports</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-96 flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
                <div className="text-center">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p>No saved reports yet</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalystDashboard;
