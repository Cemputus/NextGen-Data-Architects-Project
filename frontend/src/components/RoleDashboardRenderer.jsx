import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { DashboardGrid } from './ui/dashboard-grid';
import { KPICard } from './ui/kpi-card';
import RoleBasedCharts from './RoleBasedCharts';
import AssignedViewsSection from './AssignedViewsSection';
import { Loader2 } from 'lucide-react';

const KPI_DEFINITIONS = [
  { key: 'total_students', label: 'Total Students', subtitle: 'Scoped by applied filters', valuePath: 'total_students' },
  { key: 'avg_grade', label: 'Average Grade', subtitle: 'Completed exams only', valuePath: 'avg_grade' },
  { key: 'failed_exams', label: 'Failed Exams (FEX)', subtitle: 'Total failed exam records', valuePath: 'failed_exams' },
  { key: 'missed_exams', label: 'Missed Exams (MEX)', subtitle: 'Total missed exam records', valuePath: 'missed_exams' },
  { key: 'avg_attendance', label: 'Avg Attendance', subtitle: 'Average total hours attended', valuePath: 'avg_attendance' },
  { key: 'retention_rate', label: 'Retention Rate', subtitle: 'Active students / total', valuePath: 'retention_rate', isPercent: true },
  { key: 'graduation_rate', label: 'Graduation Rate', subtitle: 'Graduated / total', valuePath: 'graduation_rate', isPercent: true },
];

/**
 * RoleDashboardRenderer
 *
 * Shared renderer used by role dashboards (Dean, HOD, Staff, Student, etc.)
 * to render the "current" dashboard defined by role_current_dashboard + definition JSON.
 *
 * Props:
 * - stats: object with global KPI stats suitable for KPICard (e.g., /api/dashboard/stats or role analytics)
 * - type: string passed to RoleBasedCharts (e.g., 'faculty', 'staff', 'student', 'finance', 'senate', etc.)
 */
const RoleDashboardRenderer = ({ stats, type }) => {
  const [definition, setDefinition] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCurrentDefinition = async () => {
      try {
        setLoading(true);
        const resp = await axios.get('/api/dashboards/current', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        const dash = resp.data?.dashboard;
        if (!dash || !dash.definition) {
          setDefinition(null);
        } else {
          let def = dash.definition;
          if (typeof def === 'string') {
            try {
              def = JSON.parse(def);
            } catch {
              def = null;
            }
          }
          setDefinition(def && typeof def === 'object' ? def : null);
        }
      } catch (err) {
        console.error('Error loading current dashboard definition:', err);
        setDefinition(null);
      } finally {
        setLoading(false);
      }
    };

    loadCurrentDefinition();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!definition) {
    return (
      <div className="space-y-4">
        <AssignedViewsSection />
        <Card className="border-dashed border-2 border-muted">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold">No dynamic dashboard configured</CardTitle>
            <CardDescription className="text-xs">
              Ask an analyst to assign a current dashboard for this role in the Dashboard Manager.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const selectedKpis = Array.isArray(definition.kpis) && definition.kpis.length > 0
    ? definition.kpis
    : KPI_DEFINITIONS.map((k) => k.key);

  const showCharts = Array.isArray(definition.charts) && definition.charts.length > 0;

  return (
    <div className="space-y-4">
      {/* KPI grid driven by definition */}
      {stats && (
        <DashboardGrid cols={{ default: 1, sm: 2, md: 3, lg: 4 }}>
          {KPI_DEFINITIONS.filter((k) => selectedKpis.includes(k.key)).map((kpi) => {
            let value = stats?.[kpi.valuePath] ?? 0;
            if (kpi.isPercent) {
              value = `${value ?? 0}%`;
            }
            return (
              <KPICard
                key={kpi.key}
                title={kpi.label}
                value={value}
                subtitle={kpi.subtitle}
              />
            );
          })}
        </DashboardGrid>
      )}

      {/* Views assigned to this role or user by analysts (NextGen Query) */}
      <AssignedViewsSection />

      {/* RBAC-aware charts, using existing RoleBasedCharts component */}
      {showCharts && (
        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base font-semibold">Analytics</CardTitle>
            <CardDescription className="text-xs">
              Charts and visuals configured for this role&apos;s current dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {/* RoleBasedCharts already understands the role and uses filters & type to scope */}
            <RoleBasedCharts filters={{}} type={type} />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RoleDashboardRenderer;

