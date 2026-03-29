/**
 * Dual-axis line + area chart for student attendance over time
 * (periods from /api/dashboard/attendance-trends).
 */
import React, { useMemo } from 'react';
import { BaseChart } from './BaseChart';
import {
  defaultGrid,
  defaultTooltip,
  defaultTextStyle,
  UCU_COLORS,
  formatCompactNumber,
} from '../../lib/chartTheme';
import { chartEmptyStateClass } from '../../lib/analytics-ui';
import { cn } from '../../lib/utils';

/**
 * @param {Array<{ period: string, pctPresent: number, avgHours: number }>} data
 */
export function StudentAttendanceTrendChart({ data = [], className }) {
  const option = useMemo(() => {
    const periods = data.map((d) => String(d.period ?? ''));
    const pct = data.map((d) => Math.min(100, Math.max(0, Number(d.pctPresent) || 0)));
    const hrs = data.map((d) => Number(d.avgHours) || 0);

    return {
      grid: { ...defaultGrid, right: 56, bottom: 52, top: 28 },
      tooltip: {
        ...defaultTooltip,
        trigger: 'axis',
        formatter: (params) => {
          const arr = Array.isArray(params) ? params : [params];
          const label = arr[0]?.axisValueLabel ?? arr[0]?.name ?? '';
          const lines = arr.map((p) => {
            const v = Array.isArray(p.value) ? p.value[1] : p.value;
            const n = Number(v);
            if (Number.isNaN(n)) return `${p.marker} ${p.seriesName}: —`;
            if (String(p.seriesName || '').includes('%')) {
              return `${p.marker} ${p.seriesName}: ${n.toFixed(1)}%`;
            }
            return `${p.marker} ${p.seriesName}: ${formatCompactNumber(n)} hrs`;
          });
          return `${label}<br/>${lines.join('<br/>')}`;
        },
      },
      legend: {
        bottom: 0,
        textStyle: defaultTextStyle,
        itemGap: 16,
      },
      xAxis: {
        type: 'category',
        data: periods,
        boundaryGap: false,
        axisLabel: {
          ...defaultTextStyle,
          rotate: periods.length > 10 ? 32 : 0,
          interval: periods.length > 14 ? 'auto' : 0,
          hideOverlap: true,
        },
        splitLine: { show: false },
      },
      yAxis: [
        {
          type: 'value',
          name: '% present',
          min: 0,
          max: 100,
          nameTextStyle: defaultTextStyle,
          axisLabel: {
            ...defaultTextStyle,
            formatter: (v) => `${v}%`,
          },
          splitLine: { lineStyle: { type: 'dashed', opacity: 0.35 } },
        },
        {
          type: 'value',
          name: 'Avg hours',
          nameTextStyle: defaultTextStyle,
          axisLabel: {
            ...defaultTextStyle,
            formatter: (v) => formatCompactNumber(v),
          },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '% sessions present',
          type: 'line',
          smooth: true,
          yAxisIndex: 0,
          data: pct,
          showSymbol: periods.length <= 24,
          symbolSize: 6,
          itemStyle: { color: UCU_COLORS.green },
          lineStyle: { width: 2.5, color: UCU_COLORS.green },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(16, 185, 129, 0.32)' },
                { offset: 1, color: 'rgba(16, 185, 129, 0.02)' },
              ],
            },
          },
        },
        {
          name: 'Avg hours (per record)',
          type: 'line',
          smooth: true,
          yAxisIndex: 1,
          data: hrs,
          showSymbol: periods.length <= 24,
          symbolSize: 6,
          itemStyle: { color: UCU_COLORS.cyan },
          lineStyle: { width: 2, color: UCU_COLORS.cyan },
        },
      ],
    };
  }, [data]);

  if (!data.length) {
    return (
      <div
        className={cn(
          chartEmptyStateClass,
          'min-h-[280px] flex flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted-foreground',
          className
        )}
      >
        <span>No attendance trend data for your account in this range.</span>
        <span className="text-xs max-w-md">
          Data comes from fact attendance joined to your student record (access number / student ID). After
          attendance is loaded for you in the warehouse, this chart will show monthly or quarterly trends.
        </span>
      </div>
    );
  }

  return (
    <BaseChart
      option={option}
      minHeight={280}
      maxHeight={380}
      className={className}
    />
  );
}
