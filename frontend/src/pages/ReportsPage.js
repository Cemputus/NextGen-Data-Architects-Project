/**
 * Reports Page - For Senate and Analyst roles (and analysts)
 * Curated, one-click exports for common analytics views.
 */
import React, { useState } from 'react';
import { FileText, Download, BarChart3, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { PageHeader, PageContent } from '../components/ui/page-header';
import GlobalFilterPanel from '../components/GlobalFilterPanel';
import ExportButtons from '../components/ExportButtons';
import axios from 'axios';

const ReportsPage = () => {
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({});
  const [reports, setReports] = useState([]);

  const generateReport = async (format, options = {}) => {
    const { type, label } = options;
    try {
      setLoading(true);
      const response = await axios.get(`/api/export/${format}`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
        params: {
          ...filters,
          ...(type ? { type } : {})
        },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const baseName = label || 'report';
      link.setAttribute('download', `${baseName}_${new Date().toISOString().split('T')[0]}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      // Track in simple in-memory history for this session
      const now = new Date();
      setReports(prev => [
        {
          name: label || (format === 'excel' ? 'Excel Report' : 'PDF Report'),
          format,
          type: type || 'custom',
          date: now.toLocaleString()
        },
        ...prev
      ]);
    } catch (err) {
      console.error('Error generating report:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContent>
      <PageHeader
        title="Reports"
        description="Curated exports for key analytics views. All reports respect the filters you apply below."
        actions={<ExportButtons stats={{}} filters={filters} filename="comprehensive_report" />}
      />

      <GlobalFilterPanel onFilterChange={setFilters} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Dashboard summary report */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Dashboard Summary (Excel)
            </CardTitle>
            <CardDescription>
              Overall dashboard metrics and breakdowns (students, courses, enrollments, grades).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              onClick={() => generateReport('excel', { type: 'dashboard', label: 'dashboard_summary' })} 
              className="w-full"
              disabled={loading}
            >
              <Download className="h-4 w-4 mr-2" />
              Export Dashboard Summary (Excel)
            </Button>
          </CardContent>
        </Card>

        {/* FEX analytics report */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              FEX Analytics (Excel)
            </CardTitle>
            <CardDescription>
              Detailed FEX/MEX/FCW counts by faculty, department, program, and course.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              onClick={() => generateReport('excel', { type: 'fex', label: 'fex_analytics' })} 
              className="w-full"
              disabled={loading}
            >
              <Download className="h-4 w-4 mr-2" />
              Export FEX Analytics (Excel)
            </Button>
            <p className="text-xs text-muted-foreground">
              Use filters above (faculty, department, program, etc.) to narrow the export.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Simple in-session report history */}
      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Report History (this session)</CardTitle>
            <CardDescription>Recently generated reports. Click to re-generate with the same type.</CardDescription>
          </CardHeader>
          <CardContent>
            {reports.length > 0 ? (
              <div className="space-y-2">
                {reports.map((report, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">
                        {report.name} ({report.format.toUpperCase()})
                      </p>
                      <p className="text-sm text-muted-foreground">{report.date}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => generateReport(report.format, { type: report.type, label: report.name })}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Re-export
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p>No reports generated in this session yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContent>
  );
};
export default ReportsPage;






