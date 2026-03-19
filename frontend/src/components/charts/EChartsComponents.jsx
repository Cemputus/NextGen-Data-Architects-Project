/**
 * Apache ECharts chart components – drop-in replacements for SciChart.
 * Same prop API: data, xDataKey, yDataKey, height, xAxisLabel, yAxisLabel, etc.
 */
import React, { useMemo } from 'react';
import { BaseChart } from './BaseChart';
import { UCU_COLORS, CHART_PALETTE_THEME, defaultGrid, defaultTooltip, defaultTextStyle, defaultTitleTextStyle, formatTooltipValue } from '../../lib/chartTheme';

const chartHeight = 360;
const chartMinHeight = 300;
const chartMaxHeight = 480;

/** Line chart */
export function SciLineChart({
  data = [],
  xDataKey = 'x',
  yDataKey = 'y',
  height = chartHeight,
  xAxisLabel = 'X Axis',
  yAxisLabel = 'Y Axis',
  strokeColor = UCU_COLORS.cyan,
  strokeWidth = 3,
  showLegend = true,
  showGrid = true,
  smooth = true,
  symbolSize = 6,
}) {
  const option = useMemo(() => {
    const xValues = data.map((d) => d[xDataKey]);
    const yValues = data.map((d) => d[yDataKey] ?? 0);
    const x0 = xValues[0];
    const isNumericX = typeof x0 === 'number' && !Number.isNaN(x0);
    return {
      grid: defaultGrid,
      tooltip: {
        ...defaultTooltip,
        trigger: 'axis',
        formatter: (params) => {
          const p = Array.isArray(params) ? params[0] : params;
          const axisLabel = p?.axisValueLabel ?? p?.name ?? '';
          const rawVal = p?.value;
          const yVal = Array.isArray(rawVal) ? rawVal[1] : rawVal;
          return `${axisLabel}<br/>${yAxisLabel}: ${formatTooltipValue(yVal)}`;
        },
      },
      legend: showLegend ? { show: true, bottom: 0, textStyle: defaultTextStyle } : { show: false },
      xAxis: {
        type: isNumericX ? 'value' : 'category',
        data: isNumericX ? undefined : xValues,
        name: xAxisLabel,
        nameTextStyle: defaultTextStyle,
        axisLabel: { ...defaultTextStyle, interval: 0 },
        splitLine: showGrid ? { lineStyle: { type: 'dashed', opacity: 0.4 } } : { show: false },
      },
      yAxis: {
        type: 'value',
        name: yAxisLabel,
        nameTextStyle: defaultTextStyle,
        axisLabel: defaultTextStyle,
        splitLine: showGrid ? { lineStyle: { type: 'dashed', opacity: 0.4 } } : { show: false },
      },
      series: [
        {
          name: yAxisLabel,
          type: 'line',
          data: isNumericX ? data.map((d) => [d[xDataKey], d[yDataKey]]) : yValues,
          smooth,
          lineStyle: { width: strokeWidth, color: strokeColor },
          itemStyle: { color: strokeColor },
          symbol: 'circle',
          symbolSize,
        },
      ],
    };
  }, [data, xDataKey, yDataKey, xAxisLabel, yAxisLabel, strokeColor, strokeWidth, showLegend, showGrid, smooth, symbolSize]);

  if (!data || data.length === 0) {
    return (
      <BaseChart option={{}} loading={false} minHeight={chartMinHeight} maxHeight={chartMaxHeight} />
    );
  }

  return (
    <BaseChart
      option={option}
      minHeight={chartMinHeight}
      maxHeight={chartMaxHeight}
    />
  );
}

/** Bar/column chart – single or multiple series */
export function SciBarChart({
  data = [],
  xDataKey = 'name',
  yDataKey = 'value',
  yDataKeys = null,
  xAxisLabel = 'Category',
  yAxisLabel = 'Value',
  fillColor = '#4F46E5',
  showLegend = true,
  showGrid = true,
  tooltipNameKey = null,
  minHeight = chartMinHeight,
  maxHeight = chartMaxHeight,
}) {
  const option = useMemo(() => {
    const categories = data.map((d) => String(d[xDataKey] ?? ''));
    const hasMultiple = yDataKeys && Array.isArray(yDataKeys) && yDataKeys.length > 0;
    const series = hasMultiple
      ? yDataKeys.map((s, i) => ({
          name: s.label || s.key,
          type: 'bar',
          data: data.map((d) => d[s.key] ?? 0),
          itemStyle: { color: s.color || CHART_PALETTE_THEME[i % CHART_PALETTE_THEME.length] },
        }))
      : [
          {
            name: yAxisLabel,
            type: 'bar',
            data: data.map((d) => d[yDataKey] ?? 0),
            itemStyle: { color: fillColor },
          },
        ];

    return {
      grid: defaultGrid,
      tooltip: {
        ...defaultTooltip,
        formatter: (params) => {
          const p = Array.isArray(params) ? params[0] : params;
          const idx = p?.dataIndex ?? 0;
          const raw = Array.isArray(data) && data[idx] ? data[idx] : {};
          const label =
            (tooltipNameKey && raw && raw[tooltipNameKey]) || p?.name || '';
          return `${label}<br/>${yAxisLabel}: ${formatTooltipValue(p.value)}`;
        },
      },
      legend: showLegend ? { show: true, bottom: 0, textStyle: defaultTextStyle } : { show: false },
      xAxis: {
        type: 'category',
        data: categories,
        name: xAxisLabel,
        nameTextStyle: defaultTextStyle,
        axisLabel: { ...defaultTextStyle, rotate: categories.length > 8 ? 30 : 0 },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: yAxisLabel,
        nameTextStyle: defaultTextStyle,
        axisLabel: defaultTextStyle,
        splitLine: showGrid ? { lineStyle: { type: 'dashed', opacity: 0.4 } } : { show: false },
      },
      series,
    };
  }, [data, xDataKey, yDataKey, yDataKeys, xAxisLabel, yAxisLabel, fillColor, showLegend, showGrid]);

  if (!data || data.length === 0) {
    return (
      <BaseChart option={{}} loading={false} minHeight={minHeight} maxHeight={maxHeight} />
    );
  }

  return (
    <BaseChart
      option={option}
      minHeight={minHeight}
      maxHeight={maxHeight}
    />
  );
}

/** Area chart */
export function SciAreaChart({
  data = [],
  xDataKey = 'x',
  yDataKey = 'y',
  height = chartHeight,
  xAxisLabel = 'X Axis',
  yAxisLabel = 'Y Axis',
  fillColor = UCU_COLORS.gold,
  strokeColor = UCU_COLORS.gold,
  strokeWidth = 2,
  showLegend = true,
  showGrid = true,
}) {
  const option = useMemo(() => {
    const xValues = data.map((d) => d[xDataKey]);
    const yValues = data.map((d) => d[yDataKey] ?? 0);
    return {
      grid: defaultGrid,
      tooltip: defaultTooltip,
      legend: showLegend ? { show: true, bottom: 0, textStyle: defaultTextStyle } : { show: false },
      xAxis: {
        type: typeof xValues[0] === 'number' ? 'value' : 'category',
        data: typeof xValues[0] === 'number' ? undefined : xValues,
        name: xAxisLabel,
        nameTextStyle: defaultTextStyle,
        axisLabel: defaultTextStyle,
        splitLine: showGrid ? { lineStyle: { type: 'dashed', opacity: 0.4 } } : { show: false },
      },
      yAxis: {
        type: 'value',
        name: yAxisLabel,
        nameTextStyle: defaultTextStyle,
        axisLabel: defaultTextStyle,
        splitLine: showGrid ? { lineStyle: { type: 'dashed', opacity: 0.4 } } : { show: false },
      },
      series: [
        {
          name: yAxisLabel,
          type: 'line',
          data: typeof xValues[0] === 'number' ? data.map((d) => [d[xDataKey], d[yDataKey]]) : yValues,
          smooth: true,
          lineStyle: { width: strokeWidth, color: strokeColor },
          itemStyle: { color: strokeColor },
          areaStyle: { color: fillColor, opacity: 0.4 },
          symbol: 'circle',
          symbolSize: 5,
        },
      ],
    };
  }, [data, xDataKey, yDataKey, xAxisLabel, yAxisLabel, fillColor, strokeColor, strokeWidth, showLegend, showGrid]);

  if (!data || data.length === 0) {
    return (
      <BaseChart option={{}} loading={false} minHeight={chartMinHeight} maxHeight={chartMaxHeight} />
    );
  }

  return (
    <BaseChart
      option={option}
      minHeight={chartMinHeight}
      maxHeight={chartMaxHeight}
    />
  );
}

/** Stacked column (per-category bars with optional percentages in legend/tooltip) */
export function SciStackedColumnChart({
  data = [],
  xDataKey = 'name',
  yDataKey = 'value',
  height = chartHeight,
  xAxisLabel = 'Category',
  yAxisLabel = 'Value',
  colors = CHART_PALETTE_THEME,
  showLegend = true,
  showGrid = true,
  showPercentages = true,
}) {
  const option = useMemo(() => {
    const categories = data.map((d) => String(d[xDataKey] ?? ''));
    const values = data.map((d) => d[yDataKey] ?? 0);
    const total = values.reduce((s, v) => s + v, 0);

    // System-level risk color lock:
    // If stacked segments are exactly FCW/MEX/FEX, force consistent colors
    // so the palette never makes FEX appear non-red.
    const lockRiskColors = colors === CHART_PALETTE_THEME;
    const riskColorByName = {
      FCW: UCU_COLORS.maroon,
      MEX: UCU_COLORS.orange,
      FEX: UCU_COLORS.red,
    };

    const series = data.map((_, i) => {
      const arr = new Array(data.length).fill(0);
      arr[i] = values[i];
      const pct = total > 0 ? ((values[i] / total) * 100).toFixed(1) : '0';
      return {
        name: showPercentages ? `${categories[i]} (${pct}%)` : categories[i],
        type: 'bar',
        stack: 'total',
        data: arr,
        itemStyle: {
          color: lockRiskColors
            ? (riskColorByName[categories[i]] ?? colors[i % colors.length])
            : colors[i % colors.length],
        },
      };
    });

    return {
      grid: defaultGrid,
      tooltip: {
        ...defaultTooltip,
        formatter: (params) => {
          const p = Array.isArray(params) ? params[0] : params;
          const idx = p.dataIndex;
          const val = values[idx];
          const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
          return `${categories[idx]}<br/>${yAxisLabel}: ${val} (${pct}%)`;
        },
      },
      legend: showLegend ? { show: true, bottom: 0, textStyle: defaultTextStyle } : { show: false },
      xAxis: {
        type: 'category',
        data: categories,
        name: xAxisLabel,
        nameTextStyle: defaultTextStyle,
        axisLabel: { ...defaultTextStyle, rotate: categories.length > 8 ? 30 : 0 },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: yAxisLabel,
        nameTextStyle: defaultTextStyle,
        axisLabel: defaultTextStyle,
        splitLine: showGrid ? { lineStyle: { type: 'dashed', opacity: 0.4 } } : { show: false },
      },
      series,
    };
  }, [data, xDataKey, yDataKey, xAxisLabel, yAxisLabel, colors, showLegend, showGrid, showPercentages]);

  if (!data || data.length === 0) {
    return (
      <BaseChart option={{}} loading={false} minHeight={chartMinHeight} maxHeight={chartMaxHeight} />
    );
  }

  return (
    <BaseChart
      option={option}
      minHeight={chartMinHeight}
      maxHeight={chartMaxHeight}
    />
  );
}

/** Donut chart – proportions / composition (use sparingly) */
export function SciDonutChart({
  data = [],
  nameKey = 'name',
  valueKey = 'value',
  title = '',
  colors = CHART_PALETTE_THEME,
  innerRadius = '55%',
  minHeight = chartMinHeight,
  maxHeight = chartMaxHeight,
}) {
  const option = useMemo(() => {
    const seriesData = (data || []).map((d, i) => ({
      name: String(d[nameKey] ?? ''),
      value: Number(d[valueKey]) || 0,
      // Allow callers to override colors per-slice (e.g. grade distribution).
      itemStyle: { color: d.color ?? colors[i % colors.length] },
    })).filter((d) => d.value > 0);
    return {
      tooltip: {
        ...defaultTooltip,
        trigger: 'item',
        formatter: ({ name, value, percent }) =>
          `${name}: ${formatTooltipValue(value)} (${percent}%)`,
      },
      legend: {
        show: true,
        bottom: 0,
        top: 'auto',
        padding: [14, 0, 4, 0],
        itemGap: 10,
        textStyle: defaultTextStyle,
      },
      title: title ? { text: title, left: 'center', top: 8, textStyle: defaultTitleTextStyle } : undefined,
      series: [
        {
          type: 'pie',
          radius: [innerRadius, '72%'],
          center: ['50%', '38%'],
          avoidLabelOverlap: true,
          label: { show: true, fontSize: 11, formatter: '{b}: {d}%' },
          labelLine: { show: true },
          data: seriesData,
        },
      ],
    };
  }, [data, nameKey, valueKey, title, colors, innerRadius]);

  if (!data || data.length === 0) {
    return (
      <BaseChart option={{}} loading={false} minHeight={minHeight} maxHeight={maxHeight} />
    );
  }

  return (
    <BaseChart option={option} minHeight={minHeight} maxHeight={maxHeight} />
  );
}

export { UCU_COLORS };
