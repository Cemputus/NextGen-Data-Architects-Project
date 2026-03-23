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

/** Line chart — single series (`yDataKey`) or multiple (`yDataKeys` like SciBarChart). */
export function SciLineChart({
  data = [],
  xDataKey = 'x',
  yDataKey = 'y',
  yDataKeys = null,
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
    const x0 = xValues[0];
    const isNumericX = typeof x0 === 'number' && !Number.isNaN(x0);
    const hasMultiple = yDataKeys && Array.isArray(yDataKeys) && yDataKeys.length > 0;

    const series = hasMultiple
      ? yDataKeys.map((s, i) => ({
          name: s.label || s.key,
          type: 'line',
          data: isNumericX
            ? data.map((d) => [d[xDataKey], d[s.key] ?? 0])
            : data.map((d) => d[s.key] ?? 0),
          smooth,
          lineStyle: { width: s.strokeWidth ?? strokeWidth, color: s.color || CHART_PALETTE_THEME[i % CHART_PALETTE_THEME.length] },
          itemStyle: { color: s.color || CHART_PALETTE_THEME[i % CHART_PALETTE_THEME.length] },
          symbol: 'circle',
          symbolSize,
        }))
      : [
          {
            name: yAxisLabel,
            type: 'line',
            data: isNumericX ? data.map((d) => [d[xDataKey], d[yDataKey] ?? 0]) : data.map((d) => d[yDataKey] ?? 0),
            smooth,
            lineStyle: { width: strokeWidth, color: strokeColor },
            itemStyle: { color: strokeColor },
            symbol: 'circle',
            symbolSize,
          },
        ];

    return {
      grid: defaultGrid,
      tooltip: {
        ...defaultTooltip,
        trigger: 'axis',
        formatter: (params) => {
          const pArr = Array.isArray(params) ? params : [params];
          const first = pArr[0] || {};
          const axisLabel = first?.axisValueLabel ?? first?.name ?? '';
          if (hasMultiple && pArr.length > 1) {
            const lines = pArr.map((p) => `${p?.seriesName || ''}: ${formatTooltipValue(p?.value)}`).join('<br/>');
            return `${axisLabel}<br/>${lines}`;
          }
          const rawVal = first?.value;
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
        axisLabel: {
          ...defaultTextStyle,
          interval: xValues.length > 8 ? 'auto' : 0,
          rotate: xValues.length > 8 ? 45 : 0,
          hideOverlap: true,
          formatter: (value) => String(value),
        },
        splitLine: showGrid ? { lineStyle: { type: 'dashed', opacity: 0.4 } } : { show: false },
      },
      yAxis: {
        type: 'value',
        name: yAxisLabel,
        nameTextStyle: defaultTextStyle,
        axisLabel: {
          ...defaultTextStyle,
          formatter: (value) => formatTooltipValue(value),
        },
        splitLine: showGrid ? { lineStyle: { type: 'dashed', opacity: 0.4 } } : { show: false },
      },
      series,
    };
  }, [
    data,
    xDataKey,
    yDataKey,
    yDataKeys,
    xAxisLabel,
    yAxisLabel,
    strokeColor,
    strokeWidth,
    showLegend,
    showGrid,
    smooth,
    symbolSize,
  ]);

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
  tooltipMode = 'single', // 'single' (old) or 'breakdown' (multi-series breakdown)
  minHeight = chartMinHeight,
  maxHeight = chartMaxHeight,
  /** Axis tick / name font size (px); default follows theme (11). */
  axisFontSize = null,
  /** X-axis label rotation in degrees; null = auto from category count. */
  xAxisLabelRotate = null,
  /** Merge into ECharts grid (e.g. { bottom: 72, top: 48 }) for tall charts / legend. */
  gridPadding = null,
  /** When any `yDataKeys` item has `yAxisIndex: 1`, render a second y-axis (e.g. % vs GPA scale). */
  secondaryYAxisLabel = null,
}) {
  const option = useMemo(() => {
    const categories = data.map((d) => String(d[xDataKey] ?? ''));
    const hasMultiple = yDataKeys && Array.isArray(yDataKeys) && yDataKeys.length > 0;
    const useDualY =
      hasMultiple && yDataKeys.some((s) => Number(s?.yAxisIndex) === 1);
    /** FEX-style charts: legend under axis — always leave room and tilt labels to avoid collision. */
    const multiSeriesLegend = hasMultiple && showLegend;
    const fs = axisFontSize != null ? axisFontSize : defaultTextStyle.fontSize;
    const axisTextStyle = { ...defaultTextStyle, fontSize: fs };
    const nameTextStyle = { ...defaultTextStyle, fontSize: fs, fontWeight: 500 };

    const rotate =
      xAxisLabelRotate != null
        ? xAxisLabelRotate
        : multiSeriesLegend
          ? categories.length > 12
            ? 48
            : categories.length > 8
              ? 40
              : 38
          : categories.length > 10
            ? 40
            : categories.length > 6
              ? 28
              : 0;

    const pad = gridPadding && typeof gridPadding === 'object' ? gridPadding : {};
    const minBottomPx = multiSeriesLegend ? 118 : showLegend ? 78 : null;
    const grid = {
      ...defaultGrid,
      ...pad,
      top: pad.top ?? defaultGrid.top,
      left: pad.left ?? defaultGrid.left,
      right: pad.right ?? defaultGrid.right,
    };
    // Avoid Math.max('%', px) → NaN; use pixel reserve when legend + multi-series need space.
    if (minBottomPx != null) {
      const pb = pad.bottom;
      if (pb == null) {
        grid.bottom = minBottomPx;
      } else if (typeof pb === 'number') {
        grid.bottom = Math.max(pb, minBottomPx);
      } else {
        grid.bottom = pb;
      }
    } else {
      grid.bottom = pad.bottom ?? defaultGrid.bottom;
    }

    if (useDualY && pad.right == null) {
      grid.right = '14%';
    }

    const series = hasMultiple
      ? yDataKeys.map((s, i) => {
          const item = {
            name: s.label || s.key,
            type: 'bar',
            data: data.map((d) => {
              const v = d[s.key];
              const n = typeof v === 'number' ? v : Number(v);
              return Number.isFinite(n) ? n : 0;
            }),
            itemStyle: { color: s.color || CHART_PALETTE_THEME[i % CHART_PALETTE_THEME.length] },
          };
          // Only set yAxisIndex when using two y-axes; some ECharts builds mis-handle yAxisIndex:0 with a single axis.
          if (useDualY) {
            item.yAxisIndex = Number(s.yAxisIndex) === 1 ? 1 : 0;
          }
          return item;
        })
      : [
          {
            name: yAxisLabel,
            type: 'bar',
            data: data.map((d) => d[yDataKey] ?? 0),
            itemStyle: { color: fillColor },
          },
        ];

    return {
      grid,
      tooltip: {
        ...defaultTooltip,
        formatter: (params) => {
          if (params == null) return '';
          const arr = Array.isArray(params) ? params : [params];
          if (!arr.length) return '';
          const first = arr[0] || {};
          const idx = first?.dataIndex ?? 0;
          const raw = Array.isArray(data) && data[idx] ? data[idx] : {};
          const title =
            (tooltipNameKey && raw && raw[tooltipNameKey] != null && String(raw[tooltipNameKey])) ||
            first?.axisValueLabel ||
            first?.name ||
            '';

          if (tooltipMode === 'breakdown' && arr.length > 1) {
            const breakdown = arr
              .map((p) => `${p?.seriesName || ''}: ${formatTooltipValue(p?.value)}`)
              .filter(Boolean)
              .join('<br/>');
            return `${title}<br/>${breakdown}`;
          }

          if (hasMultiple) {
            const lines = arr.map(
              (p) =>
                `${p.marker || ''} ${p.seriesName}: ${formatTooltipValue(p.value)}`
            );
            return `<strong>${title}</strong><br/>${lines.join('<br/>')}`;
          }

          return `${title}<br/>${yAxisLabel}: ${formatTooltipValue(first?.value)}`;
        },
      },
      legend: showLegend
        ? {
            show: true,
            type: 'plain',
            orient: 'horizontal',
            left: 'center',
            bottom: 0,
            itemGap: multiSeriesLegend ? 40 : 22,
            itemWidth: 16,
            itemHeight: 12,
            textStyle: axisTextStyle,
            padding: multiSeriesLegend ? [4, 20, 10, 20] : [2, 12, 6, 12],
          }
        : { show: false },
      xAxis: {
        type: 'category',
        data: categories,
        name: xAxisLabel,
        nameLocation: 'middle',
        nameGap: rotate > 0 ? (multiSeriesLegend ? 52 : 44) : multiSeriesLegend ? 36 : 28,
        nameTextStyle,
        axisLabel: {
          ...axisTextStyle,
          rotate,
          margin: rotate > 0 ? (multiSeriesLegend ? 16 : 12) : 8,
          interval: 0,
          hideOverlap: true,
          formatter: (value) => String(value),
        },
        splitLine: { show: false },
      },
      yAxis: useDualY
        ? [
            {
              type: 'value',
              name: yAxisLabel,
              position: 'left',
              nameLocation: 'middle',
              nameGap: 48,
              nameTextStyle,
              axisLabel: {
                ...axisTextStyle,
                formatter: (value) => formatTooltipValue(value),
              },
              splitLine: showGrid ? { lineStyle: { type: 'dashed', opacity: 0.4 } } : { show: false },
            },
            {
              type: 'value',
              name:
                secondaryYAxisLabel ||
                yDataKeys.find((s) => Number(s?.yAxisIndex) === 1)?.label ||
                'Series 2',
              position: 'right',
              nameLocation: 'middle',
              nameGap: 48,
              nameTextStyle,
              axisLabel: {
                ...axisTextStyle,
                formatter: (value) => formatTooltipValue(value),
              },
              splitLine: { show: false },
            },
          ]
        : {
            type: 'value',
            name: yAxisLabel,
            nameLocation: 'middle',
            nameGap: 36,
            nameTextStyle,
            axisLabel: {
              ...axisTextStyle,
              formatter: (value) => formatTooltipValue(value),
            },
            splitLine: showGrid ? { lineStyle: { type: 'dashed', opacity: 0.4 } } : { show: false },
          },
      series,
    };
  }, [
    data,
    xDataKey,
    yDataKey,
    yDataKeys,
    xAxisLabel,
    yAxisLabel,
    fillColor,
    showLegend,
    showGrid,
    tooltipNameKey,
    tooltipMode,
    axisFontSize,
    xAxisLabelRotate,
    gridPadding,
    secondaryYAxisLabel,
  ]);

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

/**
 * Stacked area chart — multiple series over a shared category axis (e.g. HR attendance by day).
 * @param {Array<{ key: string, label: string, color: string, areaOpacity?: number }>} seriesKeys
 */
export function SciStackedAreaChart({
  data = [],
  xDataKey = 'date',
  seriesKeys = [],
  xAxisLabel = 'Date',
  yAxisLabel = 'Count',
  minHeight = chartMinHeight,
  maxHeight = chartMaxHeight,
  axisFontSize = null,
}) {
  const option = useMemo(() => {
    const categories = data.map((d) => String(d[xDataKey] ?? ''));
    const fs = axisFontSize != null ? axisFontSize : defaultTextStyle.fontSize;
    const axisTextStyle = { ...defaultTextStyle, fontSize: fs };
    const nameTextStyle = { ...defaultTextStyle, fontSize: fs, fontWeight: 500 };

    const series = (seriesKeys || []).map((s) => ({
      name: s.label || s.key,
      type: 'line',
      stack: 'attendance',
      areaStyle: { opacity: s.areaOpacity ?? 0.35 },
      emphasis: { focus: 'series' },
      data: data.map((d) => Number(d[s.key]) || 0),
      lineStyle: { width: 1.5, color: s.color },
      itemStyle: { color: s.color },
      smooth: true,
      symbol: 'circle',
      symbolSize: 4,
    }));

    return {
      grid: { ...defaultGrid, bottom: 52, top: 32, left: 12, right: 12 },
      tooltip: {
        ...defaultTooltip,
        trigger: 'axis',
        axisPointer: { type: 'cross' },
      },
      legend: { show: true, bottom: 4, textStyle: axisTextStyle, itemGap: 14 },
      xAxis: {
        type: 'category',
        data: categories,
        boundaryGap: false,
        name: xAxisLabel,
        nameTextStyle: nameTextStyle,
        axisLabel: {
          ...axisTextStyle,
          rotate: categories.length > 18 ? 45 : categories.length > 10 ? 30 : 0,
          interval: categories.length > 28 ? 'auto' : 0,
          hideOverlap: true,
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: yAxisLabel,
        nameTextStyle: nameTextStyle,
        axisLabel: {
          ...axisTextStyle,
          formatter: (v) => formatTooltipValue(v),
        },
        splitLine: { lineStyle: { type: 'dashed', opacity: 0.35 } },
      },
      series,
    };
  }, [data, xDataKey, seriesKeys, xAxisLabel, yAxisLabel, axisFontSize]);

  if (!data || data.length === 0 || !seriesKeys || seriesKeys.length === 0) {
    return (
      <BaseChart option={{}} loading={false} minHeight={minHeight} maxHeight={maxHeight} />
    );
  }

  return <BaseChart option={option} minHeight={minHeight} maxHeight={maxHeight} />;
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

    // Empty pie data crashes or blanks some ECharts builds (e.g. all-zero risk slices).
    if (seriesData.length === 0) {
      return {
        tooltip: { show: false },
        legend: { show: false },
        series: [
          {
            type: 'pie',
            radius: [innerRadius, '72%'],
            center: ['50%', '42%'],
            silent: true,
            data: [{ name: 'No data', value: 1, itemStyle: { color: '#e5e7eb' } }],
            label: {
              show: true,
              fontSize: 12,
              color: '#9ca3af',
              formatter: () => 'No data',
            },
            labelLine: { show: false },
          },
        ],
      };
    }

    return {
      tooltip: {
        ...defaultTooltip,
        trigger: 'item',
        formatter: ({ name, value, percent }) =>
          `${name}: ${formatTooltipValue(value)} (${percent ?? 0}%)`,
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

/** 3D-styled pie chart (visual depth using shadow + top layer) */
export function Sci3DPieChart({
  data = [],
  nameKey = 'name',
  valueKey = 'value',
  title = '',
  minHeight = chartMinHeight,
  maxHeight = chartMaxHeight,
  // Optional overrides
  failedColor = '#ef4444', // red
  successColor = '#22c55e', // green
  otherColor = '#f59e0b', // amber for the 3rd slice
}) {
  const option = useMemo(() => {
    const raw = (data || [])
      .map((d, i) => {
        const name = String(d?.[nameKey] ?? '');
        const value = Number(d?.[valueKey]) || 0;
        const up = name.toUpperCase();
        let color = otherColor;
        if (up.includes('FAILED')) color = failedColor;
        else if (up.includes('SUCCESS')) color = successColor;
        return {
          name,
          value,
          itemStyle: {
            color,
            borderColor: 'rgba(255,255,255,0.25)',
            borderWidth: 1,
          },
        };
      })
      .filter((d) => d.value > 0);

    const seriesDataTop = raw;
    const seriesDataShadow = raw.map((d) => ({
      name: d.name,
      value: d.value,
      itemStyle: {
        // Darker shadow tone of the slice color
        color: d.itemStyle?.color || otherColor,
        opacity: 0.55,
      },
    }));

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
        padding: [12, 0, 4, 0],
        itemGap: 10,
        textStyle: defaultTextStyle,
      },
      title: title ? { text: title, left: 'center', top: 8, textStyle: defaultTitleTextStyle } : undefined,
      series: [
        // Shadow / bottom layer for the 3D feel
        {
          type: 'pie',
          radius: ['55%', '78%'],
          center: ['50%', '46%'],
          label: { show: false },
          labelLine: { show: false },
          data: seriesDataShadow,
          avoidLabelOverlap: true,
        },
        // Top layer
        {
          type: 'pie',
          radius: ['55%', '78%'],
          center: ['50%', '38%'],
          avoidLabelOverlap: true,
          label: { show: true, fontSize: 11, formatter: '{b}: {d}%' },
          labelLine: { show: true },
          data: seriesDataTop,
          itemStyle: {
            borderRadius: 8,
            shadowBlur: 18,
            shadowOffsetY: 10,
            shadowColor: 'rgba(0,0,0,0.25)',
          },
        },
      ],
    };
  }, [data, nameKey, valueKey, title, failedColor, successColor, otherColor]);

  if (!data || data.length === 0) {
    return <BaseChart option={{}} loading={false} minHeight={minHeight} maxHeight={maxHeight} />;
  }

  return <BaseChart option={option} minHeight={minHeight} maxHeight={maxHeight} />;
}

/**
 * Full solid 3D-styled pie (no donut): shadow “floor” + raised top layer with soft shadow.
 * Pass a vibrant `colors` array (e.g. MODERN_CHART_PALETTE) or set `color` on each data row.
 */
export function Sci3DFullPieChart({
  data = [],
  nameKey = 'name',
  valueKey = 'value',
  title = '',
  colors = CHART_PALETTE_THEME,
  minHeight = chartMinHeight,
  maxHeight = chartMaxHeight,
  outerRadius = '64%',
  /** Larger vertical gap + shadow so the stacked layers read clearly as 3D */
  emphasizeDepth = false,
}) {
  const hasPositiveValue = (data || []).some((d) => Number(d?.[valueKey]) > 0);

  const option = useMemo(() => {
    const seriesDataTop = (data || [])
      .map((d, i) => ({
        name: String(d?.[nameKey] ?? ''),
        value: Number(d?.[valueKey]) || 0,
        itemStyle: {
          color: d.color ?? colors[i % colors.length],
          borderColor: 'rgba(255,255,255,0.22)',
          borderWidth: 1,
        },
      }))
      .filter((d) => d.value > 0);

    if (seriesDataTop.length === 0) {
      return null;
    }

    const seriesDataShadow = seriesDataTop.map((d) => ({
      name: d.name,
      value: d.value,
      itemStyle: {
        color: d.itemStyle.color,
        opacity: 0.5,
        borderWidth: 0,
      },
    }));

    const legendNames = seriesDataTop.map((d) => d.name);

    const shadowCenterY = emphasizeDepth ? '56%' : '52%';
    const topCenterY = emphasizeDepth ? '34%' : '40%';
    const sliceShadowBlur = emphasizeDepth ? 28 : 22;
    const sliceShadowOffsetY = emphasizeDepth ? 16 : 12;

    return {
      tooltip: {
        ...defaultTooltip,
        trigger: 'item',
        formatter: ({ name, value, percent }) =>
          `${name}: ${formatTooltipValue(value)} (${percent}%)`,
      },
      legend: {
        show: true,
        type: 'scroll',
        bottom: 0,
        top: 'auto',
        padding: [14, 0, 10, 0],
        itemGap: 14,
        textStyle: {
          ...defaultTextStyle,
          fontSize: 13,
          fontWeight: 600,
        },
        data: legendNames,
      },
      title: title ? { text: title, left: 'center', top: 8, textStyle: defaultTitleTextStyle } : undefined,
      series: [
        {
          type: 'pie',
          radius: outerRadius,
          center: ['50%', shadowCenterY],
          silent: true,
          tooltip: { show: false },
          animation: false,
          label: { show: false },
          labelLine: { show: false },
          data: seriesDataShadow,
          avoidLabelOverlap: true,
        },
        {
          type: 'pie',
          radius: outerRadius,
          center: ['50%', topCenterY],
          avoidLabelOverlap: true,
          label: {
            show: true,
            position: 'outside',
            alignTo: 'labelLine',
            edgeDistance: '6%',
            distanceToLabelLine: 6,
            fontSize: emphasizeDepth ? 14 : 13,
            fontWeight: 600,
            lineHeight: 20,
            color: '#0f172a',
            // High-contrast “tag” so text stays readable on any slice / background
            backgroundColor: 'rgba(255, 255, 255, 0.96)',
            borderColor: '#cbd5e1',
            borderWidth: 1,
            borderRadius: 8,
            padding: [8, 12],
            shadowBlur: 4,
            shadowColor: 'rgba(15, 23, 42, 0.12)',
            shadowOffsetY: 1,
            formatter: '{b}\n{d}%',
          },
          labelLine: {
            show: true,
            length: emphasizeDepth ? 22 : 18,
            length2: emphasizeDepth ? 16 : 14,
            smooth: true,
            lineStyle: {
              color: '#64748b',
              width: 2,
              cap: 'round',
            },
          },
          data: seriesDataTop,
          itemStyle: {
            borderRadius: emphasizeDepth ? 10 : 8,
            shadowBlur: sliceShadowBlur,
            shadowOffsetY: sliceShadowOffsetY,
            shadowColor: 'rgba(15, 23, 42, 0.32)',
          },
          emphasis: {
            scale: true,
            scaleSize: emphasizeDepth ? 6 : 5,
            itemStyle: {
              shadowBlur: emphasizeDepth ? 34 : 28,
              shadowOffsetY: emphasizeDepth ? 18 : 14,
              shadowColor: 'rgba(15, 23, 42, 0.38)',
            },
          },
        },
      ],
    };
  }, [data, nameKey, valueKey, title, colors, outerRadius, emphasizeDepth]);

  if (!data || data.length === 0 || !hasPositiveValue) {
    return <BaseChart option={{}} loading={false} minHeight={minHeight} maxHeight={maxHeight} />;
  }

  if (!option) {
    return <BaseChart option={{}} loading={false} minHeight={minHeight} maxHeight={maxHeight} />;
  }

  return <BaseChart option={option} minHeight={minHeight} maxHeight={maxHeight} />;
}

/** Full pie chart (no donut hole) */
export function SciPieChart({
  data = [],
  nameKey = 'name',
  valueKey = 'value',
  title = '',
  colors = CHART_PALETTE_THEME,
  minHeight = chartMinHeight,
  maxHeight = chartMaxHeight,
}) {
  const option = useMemo(() => {
    const seriesData = (data || [])
      .map((d, i) => ({
        name: String(d?.[nameKey] ?? ''),
        value: Number(d?.[valueKey]) || 0,
        itemStyle: { color: colors[i % colors.length] },
      }))
      .filter((d) => d.value > 0);

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
          radius: ['60%', '88%'],
          center: ['50%', '38%'],
          avoidLabelOverlap: true,
          label: { show: true, fontSize: 11, formatter: '{b}: {d}%' },
          labelLine: { show: true },
          data: seriesData,
        },
      ],
    };
  }, [data, nameKey, valueKey, title, colors]);

  if (!data || data.length === 0) {
    return <BaseChart option={{}} loading={false} minHeight={minHeight} maxHeight={maxHeight} />;
  }

  return <BaseChart option={option} minHeight={minHeight} maxHeight={maxHeight} />;
}

/** Flat full pie chart with status-based colors */
export function SciStatusPieChart({
  data = [],
  nameKey = 'name',
  valueKey = 'value',
  title = '',
  minHeight = chartMinHeight,
  maxHeight = chartMaxHeight,
  // Status mapping colors
  failedColor = '#ef4444', // red
  successColor = '#22c55e', // green
  otherColor = '#f59e0b', // amber
}) {
  const option = useMemo(() => {
    const seriesData = (data || [])
      .map((d, i) => {
        const name = String(d?.[nameKey] ?? '');
        const value = Number(d?.[valueKey]) || 0;
        const up = name.toUpperCase();
        let color = otherColor;
        if (up.includes('FAILED')) color = failedColor;
        else if (up.includes('SUCCESS')) color = successColor;
        return {
          name,
          value,
          itemStyle: {
            color,
            borderColor: 'rgba(255,255,255,0.25)',
            borderWidth: 1,
          },
        };
      })
      .filter((d) => d.value > 0);

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
        padding: [12, 0, 4, 0],
        itemGap: 10,
        textStyle: defaultTextStyle,
      },
      title: title ? { text: title, left: 'center', top: 8, textStyle: defaultTitleTextStyle } : undefined,
      series: [
        {
          type: 'pie',
          radius: ['60%', '88%'],
          center: ['50%', '38%'],
          avoidLabelOverlap: true,
          label: { show: true, fontSize: 11, formatter: '{b}: {d}%' },
          labelLine: { show: true },
          data: seriesData,
        },
      ],
    };
  }, [data, nameKey, valueKey, title, failedColor, successColor, otherColor]);

  if (!data || data.length === 0) {
    return <BaseChart option={{}} loading={false} minHeight={minHeight} maxHeight={maxHeight} />;
  }

  return <BaseChart option={option} minHeight={minHeight} maxHeight={maxHeight} />;
}

export { UCU_COLORS };
