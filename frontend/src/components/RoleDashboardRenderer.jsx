import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { DashboardGrid } from './ui/dashboard-grid';
import { KPICard } from './ui/kpi-card';
import RoleBasedCharts from './RoleBasedCharts';
import { Loader2 } from 'lucide-react';
import { VizCard } from './AssignedViewsSection';
import { KPI_DEFINITIONS } from '../config';

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
  const [pinnedVisualizations, setPinnedVisualizations] = useState([]);
  const [loadingVisualizations, setLoadingVisualizations] = useState(false);

  useEffect(() => {
    const loadCurrentDefinition = async () => {
      try {
        setLoading(true);
        const resp = await axios.get('/api/dashboards/current', {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
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

  // Load pinned NextGen Query visualizations for this dashboard (if any are configured)
  useEffect(() => {
    const loadPinned = async () => {
      if (
        !definition ||
        !Array.isArray(definition.visualization_ids) ||
        definition.visualization_ids.length === 0
      ) {
        setPinnedVisualizations([]);
        return;
      }
      try {
        setLoadingVisualizations(true);
        const resp = await axios.get('/api/query/assigned-visualizations/for-me', {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
        });
        const all = resp.data?.visualizations || [];
        const idSet = new Set(definition.visualization_ids);
        setPinnedVisualizations(all.filter((v) => idSet.has(v.id)));
      } catch (err) {
        console.error('Error loading pinned visualizations for dashboard:', err);
        setPinnedVisualizations([]);
      } finally {
        setLoadingVisualizations(false);
      }
    };
    loadPinned();
  }, [definition]);

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
  const hasPinnedVisualizations =
    Array.isArray(definition.visualization_ids) && definition.visualization_ids.length > 0;

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

      {/* NextGen Query visualizations pinned into this dashboard definition */}
      {hasPinnedVisualizations && (
        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base font-semibold">NextGen Query visualizations</CardTitle>
            <CardDescription className="text-xs">
              Visualizations created in NextGen Query and pinned into this dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {loadingVisualizations ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : pinnedVisualizations.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No pinned visualizations are currently assigned to you for this dashboard.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {pinnedVisualizations.map((viz) => (
                  <VizCard key={viz.id} viz={viz} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RoleDashboardRenderer;

