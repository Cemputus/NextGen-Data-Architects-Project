import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { DashboardGrid } from './ui/dashboard-grid';
import { KPICard } from './ui/kpi-card';
import RoleBasedCharts from './RoleBasedCharts';
import { Loader2 } from 'lucide-react';
import { VizCard } from './AssignedViewsSection';
import { KPI_DEFINITIONS } from '../config';

/** Renders `GET /api/dashboards/current` definition (KPIs, charts, pinned viz). */
const RoleDashboardRenderer = ({ stats, type = 'general', filters = {} }) => {
  const [definition, setDefinition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userMessage, setUserMessage] = useState(null);
  const [pinnedVisualizations, setPinnedVisualizations] = useState([]);
  const [loadingVisualizations, setLoadingVisualizations] = useState(false);

  const loadCurrentDefinition = useCallback(async () => {
    try {
      setLoading(true);
      const resp = await axios.get('/api/dashboards/current', {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
      });
      const dash = resp.data?.dashboard;
      setUserMessage(resp.data?.message || null);
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
      setUserMessage(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCurrentDefinition();
  }, [loadCurrentDefinition]);

  useEffect(() => {
    const onDashboardEvent = () => loadCurrentDefinition();
    window.addEventListener('ucu-dashboard-current-changed', onDashboardEvent);
    return () => window.removeEventListener('ucu-dashboard-current-changed', onDashboardEvent);
  }, [loadCurrentDefinition]);

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
    const body =
      userMessage ||
      'No dashboard is assigned for your role. Contact an analyst to assign one.';
    return (
      <div className="space-y-4">
        <Card className="border-dashed border-2 border-amber-200/80 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold">No dashboard assigned</CardTitle>
            <CardDescription className="text-xs text-foreground/90">{body}</CardDescription>
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
            <CardDescription className="text-xs">Charts from the assigned dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {/* RoleBasedCharts already understands the role and uses filters & type to scope */}
            <RoleBasedCharts filters={filters} type={type} />
          </CardContent>
        </Card>
      )}

      {/* NextGen Query visualizations pinned into this dashboard definition */}
      {hasPinnedVisualizations && (
        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base font-semibold">NextGen Query</CardTitle>
            <CardDescription className="text-xs">Pinned visualizations.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {loadingVisualizations ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : pinnedVisualizations.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No pinned visualizations for you on this dashboard.
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

