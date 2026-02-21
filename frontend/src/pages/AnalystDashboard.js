/**
 * Analyst Dashboard - Smooth, Clean UI
 */
import React, { useState } from 'react';
import { BarChart3, TrendingUp, Filter, FileText, Plus, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { PageHeader } from '../components/ui/page-header';
import GlobalFilterPanel from '../components/GlobalFilterPanel';
import ExportButtons from '../components/ExportButtons';
import FEXAnalytics from './FEXAnalytics';
import HighSchoolAnalytics from './HighSchoolAnalytics';

const AnalystDashboard = () => {
  const [filters, setFilters] = useState({});

  return (
    <div className="space-y-4">
      <PageHeader
        title="Analytics Workspace"
        subtitle="Create and modify analytics dashboards"
        actions={
          <>
            <ExportButtons filename="analyst_workspace" />
            <Button className="gap-2" size="default">
              <Plus className="h-4 w-4" />
              New Dashboard
            </Button>
          </>
        }
      />

      {/* Filters */}
      <GlobalFilterPanel onFilterChange={setFilters} />

      {/* Main Analytics Tabs */}
      <Tabs defaultValue="fex" className="space-y-3">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-1 p-1">
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

        <TabsContent value="fex" className="space-y-3">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-semibold">Failed Exam (FEX) Analytics</CardTitle>
              <CardDescription className="text-xs">Analyze student performance and identify at-risk students</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <FEXAnalytics />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="highschool" className="space-y-3">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-semibold">High School Analytics</CardTitle>
              <CardDescription className="text-xs">Track student performance by high school and district</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <HighSchoolAnalytics />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom" className="space-y-3">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-semibold">Custom Analytics Builder</CardTitle>
              <CardDescription className="text-xs">Create custom analytics dashboards</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="min-h-[200px] max-h-[320px] flex items-center justify-center text-muted-foreground text-sm border border-dashed rounded-lg">
                <div className="text-center p-4">
                  <BarChart3 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                  <p>Custom analytics builder coming soon</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-3">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-semibold">Saved Reports</CardTitle>
              <CardDescription className="text-xs">Access and manage your saved analytics reports</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="min-h-[200px] max-h-[320px] flex items-center justify-center text-muted-foreground text-sm border border-dashed rounded-lg">
                <div className="text-center p-4">
                  <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
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
