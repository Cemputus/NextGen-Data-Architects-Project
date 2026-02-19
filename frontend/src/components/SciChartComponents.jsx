/**
 * SciChart.js React Components Library
 * High-performance chart components using SciChart.js
 * Replaces Recharts for better performance and advanced features
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  SciChartSurface,
  NumericAxis,
  CategoryAxis,
  FastLineRenderableSeries,
  FastColumnRenderableSeries,
  FastMountainRenderableSeries,
  XyDataSeries,
  SciChartJsNavyTheme,
  ZoomPanModifier,
  ZoomExtentsModifier,
  MouseWheelZoomModifier,
  LegendModifier,
  CursorModifier,
  EAxisAlignment,
  EAutoRange,
  ENumericFormat,
  ESeriesType,
  LabelProvider,
} from 'scichart';
import { Loader2 } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

// UCU Branding Colors - Updated with modern, vibrant palette
const UCU_COLORS = {
  blue: '#4F46E5', // Vibrant indigo
  'blue-light': '#6366F1',
  'blue-dark': '#312E81',
  maroon: '#8B5CF6', // Rich purple (replacing maroon)
  'maroon-light': '#A78BFA',
  'maroon-dark': '#6D28D9',
  gold: '#F59E0B', // Warm amber (replacing gold)
  'gold-light': '#FBBF24',
  'gold-dark': '#D97706',
  navy: '#1E40AF',
  // Additional modern colors
  green: '#10B981',
  'green-light': '#34D399',
  red: '#EF4444',
  orange: '#F59E0B',
  purple: '#8B5CF6',
  cyan: '#06B6D4',
};

/**
 * SciChart Line Chart Component
 */
export const SciLineChart = ({
  data = [],
  xDataKey = 'x',
  yDataKey = 'y',
  height = 450,
  xAxisLabel = 'X Axis',
  yAxisLabel = 'Y Axis',
  strokeColor = UCU_COLORS.cyan,
  strokeWidth = 3,
  showLegend = true,
  showGrid = true,
  margin = { top: 20, right: 30, left: 20, bottom: 100 },
}) => {
  const chartRef = useRef(null);
  const [sciChartSurface, setSciChartSurface] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!chartRef.current || data.length === 0) {
      setLoading(false);
      return;
    }

    const initSciChart = async () => {
      try {
        setLoading(true);
        setError(null);

        const { wasmContext, sciChartSurface } = await SciChartSurface.create(chartRef.current, {
          theme: new SciChartJsNavyTheme(),
        }).catch((err) => {
          // Catch WASM loading errors
          if (err.message && (err.message.includes('WebAssembly') || err.message.includes('WASM') || err.message.includes('wasm'))) {
            throw new Error('WASM_LOAD_ERROR');
          }
          throw err;
        });

        // Create X axis (Category for string labels, Numeric for numbers)
        const isNumericX = typeof data[0]?.[xDataKey] === 'number';
        const xAxis = isNumericX
          ? new NumericAxis(wasmContext, {
              axisTitle: xAxisLabel,
              axisTitleStyle: { fontSize: 14, color: UCU_COLORS.blue, fontWeight: 'bold' },
              labelStyle: { fontSize: 12, color: UCU_COLORS.blue, fontWeight: '600' },
              drawMajorGridLines: showGrid,
              drawMinorGridLines: false,
              autoRange: EAutoRange.Always,
            })
          : new CategoryAxis(wasmContext, {
              axisTitle: xAxisLabel,
              axisTitleStyle: { fontSize: 14, color: UCU_COLORS.blue, fontWeight: 'bold' },
              labelStyle: { fontSize: 12, color: UCU_COLORS.blue, fontWeight: '600' },
              drawMajorGridLines: showGrid,
              drawMinorGridLines: false,
            });

        // Create Y axis
        const yAxis = new NumericAxis(wasmContext, {
          axisTitle: yAxisLabel,
          axisTitleStyle: { fontSize: 14, color: UCU_COLORS.blue, fontWeight: 'bold' },
          labelStyle: { fontSize: 12, color: UCU_COLORS.blue, fontWeight: '600' },
          drawMajorGridLines: showGrid,
          drawMinorGridLines: false,
          axisAlignment: EAxisAlignment.Left,
          autoRange: EAutoRange.Always,
        });

        sciChartSurface.xAxes.add(xAxis);
        sciChartSurface.yAxes.add(yAxis);

        // Prepare data
        const xValues = isNumericX
          ? data.map((d) => d[xDataKey])
          : data.map((_, idx) => idx);
        const yValues = data.map((d) => d[yDataKey] || 0);
        const labels = isNumericX ? null : data.map((d) => String(d[xDataKey] || ''));

        // Create data series - always use XyDataSeries
        const dataSeries = new XyDataSeries(wasmContext, {
          xValues,
          yValues,
          dataSeriesName: yAxisLabel,
        });

        // For category axes, set the labels using a custom label provider
        if (!isNumericX && labels && labels.length > 0) {
          const customLabelProvider = new LabelProvider();
          customLabelProvider.getLabel = (index) => labels[index] || '';
          xAxis.labelProvider = customLabelProvider;
        }

        // Create line series
        const lineSeries = new FastLineRenderableSeries(wasmContext, {
          dataSeries,
          stroke: strokeColor,
          strokeThickness: strokeWidth,
        });

        sciChartSurface.renderableSeries.add(lineSeries);

        // Add modifiers for interactivity
        sciChartSurface.chartModifiers.add(
          new ZoomPanModifier(),
          new ZoomExtentsModifier(),
          new MouseWheelZoomModifier(),
          new CursorModifier(),
          ...(showLegend ? [new LegendModifier({ showLegend: true })] : [])
        );

        setSciChartSurface(sciChartSurface);
        setLoading(false);
      } catch (err) {
        console.error('SciChart initialization error:', err);
        // Check for WASM-related errors
        const errorMessage = err.message || String(err);
        if (errorMessage.includes('WebAssembly') || errorMessage.includes('WASM') || errorMessage.includes('wasm') || errorMessage === 'WASM_LOAD_ERROR') {
          setError('WASM_LOAD_ERROR');
        } else {
          setError(errorMessage);
        }
        setLoading(false);
      }
    };

    initSciChart();

    return () => {
      if (sciChartSurface) {
        sciChartSurface.delete();
      }
    };
  }, [data, xDataKey, yDataKey, height, xAxisLabel, yAxisLabel, strokeColor, strokeWidth, showLegend, showGrid]);

  // Fallback to Recharts if SciChart WASM fails to load
  if (error && (error.includes('WebAssembly') || error.includes('WASM') || error.includes('wasm') || error === 'WASM_LOAD_ERROR')) {
    console.warn('SciChart WASM not available, using Recharts fallback for LineChart');
    return (
      <div style={{ height: `${height}px`, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xDataKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line 
              type="monotone" 
              dataKey={yDataKey} 
              stroke={strokeColor} 
              strokeWidth={strokeWidth}
              dot={{ fill: strokeColor, r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-red-600 border-2 border-dashed rounded-lg">
        <div className="text-center">
          <p className="text-lg font-medium">Chart Error</p>
          <p className="text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
        <div className="text-center">
          <p className="text-lg font-medium">No data available</p>
          <p className="text-sm mt-2">Try adjusting your filters or check if data exists.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: `${height}px`, width: '100%', position: 'relative' }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: UCU_COLORS.blue }} />
        </div>
      )}
      <div ref={chartRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

/**
 * SciChart Bar/Column Chart Component
 * Supports single or multiple series
 */
export const SciBarChart = ({
  data = [],
  xDataKey = 'name',
  yDataKey = 'value',
  yDataKeys = null, // Array of { key, label, color } for multiple series
  height = 450,
  xAxisLabel = 'Category',
  yAxisLabel = 'Value',
  fillColor = '#4F46E5',
  showLegend = true,
  showGrid = true,
  margin = { top: 20, right: 30, left: 20, bottom: 100 },
}) => {
  const chartRef = useRef(null);
  const [sciChartSurface, setSciChartSurface] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!chartRef.current || data.length === 0) {
      setLoading(false);
      return;
    }

    const initSciChart = async () => {
      try {
        setLoading(true);
        setError(null);

        const { wasmContext, sciChartSurface } = await SciChartSurface.create(chartRef.current, {
          theme: new SciChartJsNavyTheme(),
        }).catch((err) => {
          // Catch WASM loading errors
          if (err.message && (err.message.includes('WebAssembly') || err.message.includes('WASM') || err.message.includes('wasm'))) {
            throw new Error('WASM_LOAD_ERROR');
          }
          throw err;
        });

        // Create Category X axis
        const xAxis = new CategoryAxis(wasmContext, {
          axisTitle: xAxisLabel,
          axisTitleStyle: { fontSize: 14, color: UCU_COLORS.blue, fontWeight: 'bold' },
          labelStyle: { fontSize: 12, color: UCU_COLORS.blue, fontWeight: '600' },
          drawMajorGridLines: showGrid,
          drawMinorGridLines: false,
        });

        // Create Numeric Y axis
        const yAxis = new NumericAxis(wasmContext, {
          axisTitle: yAxisLabel,
          axisTitleStyle: { fontSize: 14, color: UCU_COLORS.blue, fontWeight: 'bold' },
          labelStyle: { fontSize: 12, color: UCU_COLORS.blue, fontWeight: '600' },
          drawMajorGridLines: showGrid,
          drawMinorGridLines: false,
          axisAlignment: EAxisAlignment.Left,
          autoRange: EAutoRange.Always,
        });

        sciChartSurface.xAxes.add(xAxis);
        sciChartSurface.yAxes.add(yAxis);

        // Prepare data - use numeric indices for category data
        const labels = data.map((d) => String(d[xDataKey] || ''));
        const xValues = data.map((_, idx) => idx);
        
        // Set labels on the category axis using a custom label provider
        const customLabelProvider = new LabelProvider();
        customLabelProvider.getLabel = (index) => labels[index] || '';
        xAxis.labelProvider = customLabelProvider;

        // Support multiple series or single series
        if (yDataKeys && Array.isArray(yDataKeys) && yDataKeys.length > 0) {
          // Multiple series
          yDataKeys.forEach((seriesConfig) => {
            const yValues = data.map((d) => d[seriesConfig.key] || 0);
            const dataSeries = new XyDataSeries(wasmContext, {
              xValues,
              yValues,
              dataSeriesName: seriesConfig.label || seriesConfig.key,
            });

            const columnSeries = new FastColumnRenderableSeries(wasmContext, {
              dataSeries,
              fill: seriesConfig.color || fillColor,
              stroke: '#312E81',
              strokeThickness: 1,
            });

            sciChartSurface.renderableSeries.add(columnSeries);
          });
        } else {
          // Single series
          const yValues = data.map((d) => d[yDataKey] || 0);
          const dataSeries = new XyDataSeries(wasmContext, {
            xValues,
            yValues,
            dataSeriesName: yAxisLabel,
          });

          const columnSeries = new FastColumnRenderableSeries(wasmContext, {
            dataSeries,
            fill: fillColor,
            stroke: '#312E81',
            strokeThickness: 1,
          });

          sciChartSurface.renderableSeries.add(columnSeries);
        }

        // Add modifiers
        sciChartSurface.chartModifiers.add(
          new ZoomPanModifier(),
          new ZoomExtentsModifier(),
          new MouseWheelZoomModifier(),
          new CursorModifier(),
          ...(showLegend ? [new LegendModifier({ showLegend: true })] : [])
        );

        setSciChartSurface(sciChartSurface);
        setLoading(false);
      } catch (err) {
        console.error('SciChart initialization error:', err);
        // Check for WASM-related errors
        const errorMessage = err.message || String(err);
        if (errorMessage.includes('WebAssembly') || errorMessage.includes('WASM') || errorMessage.includes('wasm') || errorMessage === 'WASM_LOAD_ERROR') {
          setError('WASM_LOAD_ERROR');
        } else {
          setError(errorMessage);
        }
        setLoading(false);
      }
    };

    initSciChart();

    return () => {
      if (sciChartSurface) {
        sciChartSurface.delete();
      }
    };
  }, [data, xDataKey, yDataKey, yDataKeys, height, xAxisLabel, yAxisLabel, fillColor, showLegend, showGrid]);

  // Fallback to Recharts if SciChart WASM fails to load
  if (error && (error.includes('WebAssembly') || error.includes('WASM') || error.includes('wasm') || error === 'WASM_LOAD_ERROR')) {
    console.warn('SciChart WASM not available, using Recharts fallback for BarChart');
    return (
      <div style={{ height: `${height}px`, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xDataKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            {yDataKeys && Array.isArray(yDataKeys) && yDataKeys.length > 0 ? (
              yDataKeys.map((seriesConfig, index) => (
                <Bar key={index} dataKey={seriesConfig.key} fill={seriesConfig.color || fillColor} />
              ))
            ) : (
              <Bar dataKey={yDataKey} fill={fillColor} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-red-600 border-2 border-dashed rounded-lg">
        <div className="text-center">
          <p className="text-lg font-medium">Chart Error</p>
          <p className="text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
        <div className="text-center">
          <p className="text-lg font-medium">No data available</p>
          <p className="text-sm mt-2">Try adjusting your filters or check if data exists.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: `${height}px`, width: '100%', position: 'relative' }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: UCU_COLORS.blue }} />
        </div>
      )}
      <div ref={chartRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

/**
 * SciChart Area/Mountain Chart Component
 */
export const SciAreaChart = ({
  data = [],
  xDataKey = 'x',
  yDataKey = 'y',
  height = 450,
  xAxisLabel = 'X Axis',
  yAxisLabel = 'Y Axis',
  fillColor = UCU_COLORS.gold,
  strokeColor = UCU_COLORS.gold,
  strokeWidth = 3,
  showLegend = true,
  showGrid = true,
  margin = { top: 20, right: 30, left: 20, bottom: 100 },
}) => {
  const chartRef = useRef(null);
  const [sciChartSurface, setSciChartSurface] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!chartRef.current || data.length === 0) {
      setLoading(false);
      return;
    }

    const initSciChart = async () => {
      try {
        setLoading(true);
        setError(null);

        const { wasmContext, sciChartSurface } = await SciChartSurface.create(chartRef.current, {
          theme: new SciChartJsNavyTheme(),
        }).catch((err) => {
          // Catch WASM loading errors
          if (err.message && (err.message.includes('WebAssembly') || err.message.includes('WASM') || err.message.includes('wasm'))) {
            throw new Error('WASM_LOAD_ERROR');
          }
          throw err;
        });

        // Create X axis
        const isNumericX = typeof data[0]?.[xDataKey] === 'number';
        const xAxis = isNumericX
          ? new NumericAxis(wasmContext, {
              axisTitle: xAxisLabel,
              axisTitleStyle: { fontSize: 14, color: UCU_COLORS.blue, fontWeight: 'bold' },
              labelStyle: { fontSize: 12, color: UCU_COLORS.blue, fontWeight: '600' },
              drawMajorGridLines: showGrid,
              drawMinorGridLines: false,
              autoRange: EAutoRange.Always,
            })
          : new CategoryAxis(wasmContext, {
              axisTitle: xAxisLabel,
              axisTitleStyle: { fontSize: 14, color: UCU_COLORS.blue, fontWeight: 'bold' },
              labelStyle: { fontSize: 12, color: UCU_COLORS.blue, fontWeight: '600' },
              drawMajorGridLines: showGrid,
              drawMinorGridLines: false,
            });

        // Create Y axis
        const yAxis = new NumericAxis(wasmContext, {
          axisTitle: yAxisLabel,
          axisTitleStyle: { fontSize: 14, color: UCU_COLORS.blue, fontWeight: 'bold' },
          labelStyle: { fontSize: 12, color: UCU_COLORS.blue, fontWeight: '600' },
          drawMajorGridLines: showGrid,
          drawMinorGridLines: false,
          axisAlignment: EAxisAlignment.Left,
          autoRange: EAutoRange.Always,
        });

        sciChartSurface.xAxes.add(xAxis);
        sciChartSurface.yAxes.add(yAxis);

        // Prepare data
        // For category axes, use numeric indices (0, 1, 2...) and set labels on the axis
        const xValues = isNumericX
          ? data.map((d) => d[xDataKey])
          : data.map((_, idx) => idx);
        const yValues = data.map((d) => d[yDataKey] || 0);
        const labels = isNumericX ? null : data.map((d) => String(d[xDataKey] || ''));

        // Create data series - always use XyDataSeries
        const dataSeries = new XyDataSeries(wasmContext, {
          xValues,
          yValues,
          dataSeriesName: yAxisLabel,
        });

        // For category axes, set the labels using a custom label provider
        if (!isNumericX && labels && labels.length > 0) {
          const customLabelProvider = new LabelProvider();
          customLabelProvider.getLabel = (index) => labels[index] || '';
          xAxis.labelProvider = customLabelProvider;
        }

        // Create mountain/area series
        const mountainSeries = new FastMountainRenderableSeries(wasmContext, {
          dataSeries,
          stroke: strokeColor,
          strokeThickness: strokeWidth,
          fill: fillColor,
          fillOpacity: 0.6,
        });

        sciChartSurface.renderableSeries.add(mountainSeries);

        // Add modifiers
        sciChartSurface.chartModifiers.add(
          new ZoomPanModifier(),
          new ZoomExtentsModifier(),
          new MouseWheelZoomModifier(),
          new CursorModifier(),
          ...(showLegend ? [new LegendModifier({ showLegend: true })] : [])
        );

        setSciChartSurface(sciChartSurface);
        setLoading(false);
      } catch (err) {
        console.error('SciChart initialization error:', err);
        // Check for WASM-related errors
        const errorMessage = err.message || String(err);
        if (errorMessage.includes('WebAssembly') || errorMessage.includes('WASM') || errorMessage.includes('wasm') || errorMessage === 'WASM_LOAD_ERROR') {
          setError('WASM_LOAD_ERROR');
        } else {
          setError(errorMessage);
        }
        setLoading(false);
      }
    };

    initSciChart();

    return () => {
      if (sciChartSurface) {
        sciChartSurface.delete();
      }
    };
  }, [data, xDataKey, yDataKey, height, xAxisLabel, yAxisLabel, fillColor, strokeColor, strokeWidth, showLegend, showGrid]);

  // Fallback to Recharts if SciChart WASM fails to load
  if (error && (error.includes('WebAssembly') || error.includes('WASM') || error.includes('wasm') || error === 'WASM_LOAD_ERROR')) {
    console.warn('SciChart WASM not available, using Recharts fallback for AreaChart');
    return (
      <div style={{ height: `${height}px`, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xDataKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area 
              type="monotone" 
              dataKey={yDataKey} 
              stroke={strokeColor} 
              fill={fillColor}
              fillOpacity={0.6}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-red-600 border-2 border-dashed rounded-lg">
        <div className="text-center">
          <p className="text-lg font-medium">Chart Error</p>
          <p className="text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
        <div className="text-center">
          <p className="text-lg font-medium">No data available</p>
          <p className="text-sm mt-2">Try adjusting your filters or check if data exists.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: `${height}px`, width: '100%', position: 'relative' }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: UCU_COLORS.blue }} />
        </div>
      )}
      <div ref={chartRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

/**
 * SciChart Stacked Column Chart Component
 * Alternative to pie charts - shows proportional data as stacked columns
 * Works similarly to pie charts by showing proportions and distributions
 */
export const SciStackedColumnChart = ({
  data = [],
  xDataKey = 'name',
  yDataKey = 'value',
  height = 450,
  xAxisLabel = 'Category',
  yAxisLabel = 'Value',
  colors = [UCU_COLORS.blue, UCU_COLORS.gold, UCU_COLORS['blue-light'], '#10b981', '#f59e0b'],
  showLegend = true,
  showGrid = true,
  showPercentages = true, // Show percentages like pie charts
}) => {
  const chartRef = useRef(null);
  const [sciChartSurface, setSciChartSurface] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!chartRef.current || data.length === 0) {
      setLoading(false);
      return;
    }

    const initSciChart = async () => {
      try {
        setLoading(true);
        setError(null);

        const { wasmContext, sciChartSurface } = await SciChartSurface.create(chartRef.current, {
          theme: new SciChartJsNavyTheme(),
        }).catch((err) => {
          // Catch WASM loading errors
          if (err.message && (err.message.includes('WebAssembly') || err.message.includes('WASM') || err.message.includes('wasm'))) {
            throw new Error('WASM_LOAD_ERROR');
          }
          throw err;
        });

        // Create Category X axis
        const xAxis = new CategoryAxis(wasmContext, {
          axisTitle: xAxisLabel,
          axisTitleStyle: { fontSize: 14, color: UCU_COLORS.blue, fontWeight: 'bold' },
          labelStyle: { fontSize: 12, color: UCU_COLORS.blue, fontWeight: '600' },
          drawMajorGridLines: showGrid,
          drawMinorGridLines: false,
        });

        // Create Numeric Y axis
        const yAxis = new NumericAxis(wasmContext, {
          axisTitle: yAxisLabel,
          axisTitleStyle: { fontSize: 14, color: UCU_COLORS.blue, fontWeight: 'bold' },
          labelStyle: { fontSize: 12, color: UCU_COLORS.blue, fontWeight: '600' },
          drawMajorGridLines: showGrid,
          drawMinorGridLines: false,
          axisAlignment: EAxisAlignment.Left,
          autoRange: EAutoRange.Always,
        });

        sciChartSurface.xAxes.add(xAxis);
        sciChartSurface.yAxes.add(yAxis);

        // Prepare data - create individual columns for each category (pie chart alternative)
        const labels = data.map((d) => String(d[xDataKey] || ''));
        const xValues = data.map((_, idx) => idx);
        const yValues = data.map((d) => d[yDataKey] || 0);
        const total = yValues.reduce((sum, val) => sum + val, 0);

        // Set labels on the category axis using a custom label provider
        const customLabelProvider = new LabelProvider();
        customLabelProvider.getLabel = (index) => labels[index] || '';
        xAxis.labelProvider = customLabelProvider;

        // Create individual column series for each category to get different colors
        // Each column represents a category (like a pie slice)
        data.forEach((entry, index) => {
          const value = entry[yDataKey] || 0;
          const percentage = total > 0 ? (value / total) * 100 : 0;
          
          // Create individual data series for each category
          const categoryYValues = new Array(data.length).fill(0);
          categoryYValues[index] = value;
          
          const categoryDataSeries = new XyDataSeries(wasmContext, {
            xValues,
            yValues: categoryYValues,
            dataSeriesName: showPercentages 
              ? `${entry[xDataKey]}: ${value} (${percentage.toFixed(1)}%)`
              : `${entry[xDataKey]}: ${value}`,
          });

          const columnSeries = new FastColumnRenderableSeries(wasmContext, {
            dataSeries: categoryDataSeries,
            fill: colors[index % colors.length],
            stroke: '#312E81',
            strokeThickness: 1,
          });

          sciChartSurface.renderableSeries.add(columnSeries);
        });

        // Add modifiers
        sciChartSurface.chartModifiers.add(
          new ZoomPanModifier(),
          new ZoomExtentsModifier(),
          new MouseWheelZoomModifier(),
          new CursorModifier(),
          ...(showLegend ? [new LegendModifier({ showLegend: true })] : [])
        );

        setSciChartSurface(sciChartSurface);
        setLoading(false);
      } catch (err) {
        console.error('SciChart initialization error:', err);
        // Check for WASM-related errors
        const errorMessage = err.message || String(err);
        if (errorMessage.includes('WebAssembly') || errorMessage.includes('WASM') || errorMessage.includes('wasm') || errorMessage === 'WASM_LOAD_ERROR') {
          setError('WASM_LOAD_ERROR');
        } else {
          setError(errorMessage);
        }
        setLoading(false);
      }
    };

    initSciChart();

    return () => {
      if (sciChartSurface) {
        sciChartSurface.delete();
      }
    };
  }, [data, xDataKey, yDataKey, height, xAxisLabel, yAxisLabel, colors, showLegend, showGrid, showPercentages]);

  // Fallback to Recharts Pie Chart if SciChart WASM fails to load
  if (error && (error.includes('WebAssembly') || error.includes('WASM'))) {
    console.warn('SciChart WASM not available, using Recharts PieChart fallback');
    const total = data.reduce((sum, d) => sum + (d[yDataKey] || 0), 0);
    return (
      <div style={{ height: `${height}px`, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(1)}%)`}
              outerRadius={120}
              fill="#8884d8"
              dataKey={yDataKey}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-red-600 border-2 border-dashed rounded-lg">
        <div className="text-center">
          <p className="text-lg font-medium">Chart Error</p>
          <p className="text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
        <div className="text-center">
          <p className="text-lg font-medium">No data available</p>
          <p className="text-sm mt-2">Try adjusting your filters or check if data exists.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: `${height}px`, width: '100%', position: 'relative' }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: UCU_COLORS.blue }} />
        </div>
      )}
      <div ref={chartRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

// Export UCU colors for use in other components
export { UCU_COLORS };

