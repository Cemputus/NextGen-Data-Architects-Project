/**
 * Reports Page - For Senate and Analyst roles
 */
import React, { useState, useEffect } from 'react';
import { FileText, Download, Share2, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import GlobalFilterPanel from '../components/GlobalFilterPanel';
import ExportButtons from '../components/ExportButtons';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

const ReportsPage = () => {
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({});
  const [reports, setReports] = useState([]);

  const generateReport = async (format) => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/export/${format}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: filters,
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report_${new Date().toISOString().split('T')[0]}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Error generating report:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-muted-foreground">Generate and download comprehensive reports</p>
        </div>
        <ExportButtons stats={{}} filters={filters} filename="comprehensive_report" />
      </div>

      <GlobalFilterPanel onFilterChange={setFilters} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Generate Report
            </CardTitle>
            <CardDescription>Create a new report with current filters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              onClick={() => generateReport('excel')} 
              className="w-full"
              disabled={loading}
            >
              <Download className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
            <Button 
              onClick={() => generateReport('pdf')} 
              variant="outline"
              className="w-full"
              disabled={loading}
            >
              <FileText className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Report History</CardTitle>
            <CardDescription>Previously generated reports</CardDescription>
          </CardHeader>
          <CardContent>
            {reports.length > 0 ? (
              <div className="space-y-2">
                {reports.map((report, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{report.name}</p>
                      <p className="text-sm text-muted-foreground">{report.date}</p>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p>No reports generated yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReportsPage;






