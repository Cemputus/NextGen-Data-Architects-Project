/**
 * Advanced Trend Chart – Apache ECharts
 * Multi-series line/area/composed trend analysis. useSciChart prop ignored (ECharts only).
 */
import React, { useMemo } from 'react';
import { BaseChart } from './charts/BaseChart';
import { UCU_COLORS, defaultGrid, defaultTooltip, defaultTextStyle } from '../lib/chartTheme';

export default function AdvancedTrendChart({
  data = [],
  title = 'Trend Analysis',
  xDataKey = 'period',
  yDataKeys = [{ key: 'value', label: 'Value', color: UCU_COLORS.cyan }],
  chartType = 'line',
  height = 360,
  showLegend = true,
  yAxisLabel = 'Value',
  xAxisLabel = 'Time Period',
  useSciChart = false,
}) {
  const option = useMemo(() => {
    if (!data || data.length === 0) return {};

    const categories = data.map((d) => String(d[xDataKey] ?? ''));
    const series = yDataKeys.map((yData) => {
      const values = data.map((d) => d[yData.key] ?? 0);
      const isArea = chartType === 'area';
      const base = {
        name: yData.label,
        type: 'line',
        data: values,
        smooth: true,
        lineStyle: { width: 2, color: yData.color || UCU_COLORS.cyan },
        itemStyle: { color: yData.color || UCU_COLORS.cyan },
        symbol: 'circle',
        symbolSize: 5,
      };
      if (isArea) {
        base.areaStyle = { color: yData.color || UCU_COLORS.cyan, opacity: 0.35 };
      }
      if (chartType === 'composed' && yData.type === 'bar') {
        base.type = 'bar';
        base.itemStyle = { color: yData.color || UCU_COLORS.blue };
      }
      return base;
    });

    return {
      grid: defaultGrid,
      tooltip: defaultTooltip,
      legend: showLegend ? { show: true, bottom: 0, textStyle: defaultTextStyle } : { show: false },
      xAxis: {
        type: 'category',
        data: categories,
        name: xAxisLabel,
        nameTextStyle: defaultTextStyle,
        axisLabel: { ...defaultTextStyle, rotate: categories.length > 10 ? 35 : 0 },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: yAxisLabel,
        nameTextStyle: defaultTextStyle,
        axisLabel: defaultTextStyle,
        splitLine: { lineStyle: { type: 'dashed', opacity: 0.4 } },
      },
      series,
    };
  }, [data, xDataKey, yDataKeys, chartType, xAxisLabel, yAxisLabel, showLegend]);

  return (
    <BaseChart
      option={option}
      minHeight={220}
      maxHeight={Math.min(420, height)}
    />
  );
}
