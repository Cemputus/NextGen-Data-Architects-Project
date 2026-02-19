/**
 * Advanced Trend Chart Component
 * Uses SciChart.js for high-performance, advanced trend analysis visualizations
 * Falls back to enhanced Recharts if SciChart is not available
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  SciChartSurface,
  NumericAxis,
  FastLineRenderableSeries,
  XyDataSeries,
  SciChartJsNavyTheme,
  ZoomPanModifier,
  ZoomExtentsModifier,
  MouseWheelZoomModifier,
  LegendModifier,
  CursorModifier,
  EAxisAlignment,
} from 'scichart';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Loader2 } from 'lucide-react';

// UCU Branding Colors - Updated with modern, vibrant palette
const UCU_COLORS = {
  blue: '#4F46E5', // Vibrant indigo
  'blue-light': '#6366F1',
  'blue-dark': '#312E81',
  maroon: '#8B5CF6', // Rich purple
  'maroon-light': '#A78BFA',
  'maroon-dark': '#6D28D9',
  gold: '#F59E0B', // Warm amber
  'gold-light': '#FBBF24',
  'gold-dark': '#D97706',
  navy: '#1E40AF',
  green: '#10B981',
  cyan: '#06B6D4',
};

const AdvancedTrendChart = ({
  data = [],
  title = 'Trend Analysis',
  xDataKey = 'period',
  yDataKeys = [{ key: 'value', label: 'Value', color: UCU_COLORS.cyan }],
  chartType = 'line', // 'line', 'area', 'composed'
  height = 400,
  showLegend = true,
  yAxisLabel = 'Value',
  xAxisLabel = 'Time Period',
  useSciChart = false, // Set to true to use SciChart (requires license)
}) => {
  const chartRef = useRef(null);
  const [sciChartSurface, setSciChartSurface] = useState(null);
  const [loading, setLoading] = useState(false);
  const [useAdvanced, setUseAdvanced] = useState(useSciChart);

  // Initialize SciChart (if enabled and available)
  useEffect(() => {
    if (!useAdvanced || !chartRef.current || data.length === 0) {
      return;
    }

    const initSciChart = async () => {
      try {
        setLoading(true);
        const { wasmContext } = await SciChartSurface.create(chartRef.current, {
          theme: new SciChartJsNavyTheme(),
        });

        // Create X and Y axes
        const xAxis = new NumericAxis(wasmContext, {
          axisTitle: xAxisLabel,
          axisTitleStyle: { fontSize: 14, color: UCU_COLORS.blue },
          labelStyle: { fontSize: 11, color: UCU_COLORS.blue },
          drawMajorGridLines: true,
          drawMinorGridLines: false,
        });

        const yAxis = new NumericAxis(wasmContext, {
          axisTitle: yAxisLabel,
          axisTitleStyle: { fontSize: 14, color: UCU_COLORS.blue },
          labelStyle: { fontSize: 11, color: UCU_COLORS.blue },
          drawMajorGridLines: true,
          drawMinorGridLines: false,
          axisAlignment: EAxisAlignment.Left,
        });

        wasmContext.engine.addChart(xAxis, yAxis);

        // Create data series for each yDataKey
        yDataKeys.forEach((yData, index) => {
          const xValues = data.map((_, idx) => idx);
          const yValues = data.map((d) => d[yData.key] || 0);

          const dataSeries = new XyDataSeries(wasmContext, {
            xValues,
            yValues,
            dataSeriesName: yData.label,
          });

          const lineSeries = new FastLineRenderableSeries(wasmContext, {
            dataSeries,
            stroke: yData.color || UCU_COLORS.blue,
            strokeThickness: 3,
          });

          wasmContext.engine.addChart(lineSeries);
        });

        // Add modifiers for interactivity
        wasmContext.chartModifiers.add(
          new ZoomPanModifier(),
          new ZoomExtentsModifier(),
          new MouseWheelZoomModifier(),
          new CursorModifier(),
          new LegendModifier({ showLegend: showLegend })
        );

        setSciChartSurface(wasmContext);
        setLoading(false);
      } catch (error) {
        console.warn('SciChart initialization failed, falling back to Recharts:', error);
        setUseAdvanced(false);
        setLoading(false);
      }
    };

    initSciChart();

    return () => {
      if (sciChartSurface) {
        sciChartSurface.delete();
      }
    };
  }, [data, useAdvanced, yDataKeys, xDataKey, xAxisLabel, yAxisLabel, showLegend]);

  // Enhanced Recharts fallback
  if (!useAdvanced || loading) {
    const ChartComponent = chartType === 'area' ? AreaChart : chartType === 'composed' ? ComposedChart : LineChart;

    return (
      <div style={{ height: `${height}px`, width: '100%' }}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: UCU_COLORS.blue }} />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ChartComponent data={data} margin={{ top: 10, right: 30, left: 20, bottom: 60 }}>
              <defs>
                <linearGradient id="colorGrade" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={UCU_COLORS.gold} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={UCU_COLORS.gold} stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="colorAttendance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={UCU_COLORS.blue} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={UCU_COLORS.blue} stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
              <XAxis
                dataKey={xDataKey}
                angle={-45}
                textAnchor="end"
                height={80}
                stroke={UCU_COLORS.blue}
                fontSize={12}
                fontWeight="500"
                label={{ value: xAxisLabel, position: 'insideBottom', offset: -5, style: { fill: UCU_COLORS.blue, fontWeight: 'bold', fontSize: 12 } }}
              />
              <YAxis
                stroke={UCU_COLORS.blue}
                fontSize={12}
                fontWeight="500"
                label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', style: { fill: UCU_COLORS.blue, fontWeight: 'bold', fontSize: 12 } }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: `2px solid ${UCU_COLORS.blue}`,
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  fontSize: '12px',
                }}
                cursor={{ stroke: UCU_COLORS.blue, strokeWidth: 1 }}
              />
              {showLegend && (
                <Legend
                  wrapperStyle={{ paddingTop: '10px' }}
                  iconType="line"
                  formatter={(value) => <span style={{ color: UCU_COLORS.blue, fontSize: '12px' }}>{value}</span>}
                />
              )}
              {yDataKeys.map((yData, index) => {
                if (chartType === 'area') {
                  return (
                    <Area
                      key={yData.key}
                      type="monotone"
                      dataKey={yData.key}
                      stroke={yData.color || UCU_COLORS.blue}
                      fill={yData.fillColor || `url(#color${index === 0 ? 'Grade' : 'Attendance'})`}
                      fillOpacity={0.6}
                      strokeWidth={3}
                      name={yData.label}
                      dot={{ fill: yData.color || UCU_COLORS.blue, r: 4 }}
                      activeDot={{ r: 6, fill: yData.color || UCU_COLORS.blue }}
                    />
                  );
                } else if (chartType === 'composed' && yData.type === 'bar') {
                  return (
                    <Bar
                      key={yData.key}
                      dataKey={yData.key}
                      fill={yData.color || UCU_COLORS.blue}
                      name={yData.label}
                      radius={[8, 8, 0, 0]}
                    />
                  );
                } else {
                  return (
                    <Line
                      key={yData.key}
                      type="monotone"
                      dataKey={yData.key}
                      stroke={yData.color || UCU_COLORS.blue}
                      strokeWidth={3}
                      name={yData.label}
                      dot={{ fill: yData.color || UCU_COLORS.blue, r: 4 }}
                      activeDot={{ r: 6, fill: yData.color || UCU_COLORS.blue }}
                    />
                  );
                }
              })}
            </ChartComponent>
          </ResponsiveContainer>
        )}
      </div>
    );
  }

  // SciChart rendering
  return (
    <div style={{ height: `${height}px`, width: '100%' }}>
      <div ref={chartRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default AdvancedTrendChart;



