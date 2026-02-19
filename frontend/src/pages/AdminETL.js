/**
 * Admin ETL Jobs Page - ETL job management
 */
import React, { useState, useEffect } from 'react';
import { BarChart3, Play, Pause, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Loader2 } from 'lucide-react';

const AdminETL = () => {
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState([]);

  const runETL = async () => {
    try {
      setLoading(true);
      // TODO: Implement ETL trigger API
      console.log('Running ETL job...');
    } catch (err) {
      console.error('Error running ETL:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ETL Jobs</h1>
          <p className="text-muted-foreground">Manage data extraction, transformation, and loading jobs</p>
        </div>
        <Button onClick={runETL} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Run ETL
            </>
          )}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ETL Job Status</CardTitle>
          <CardDescription>Current and historical ETL job executions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            ETL job management interface will be displayed here
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminETL;






