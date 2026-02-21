/**
 * Reusable Apache ECharts wrapper (echarts-for-react).
 * - Auto-resizes with container (echarts-for-react handles resize on container change)
 * - Responsive height via minHeight/maxHeight (no fixed pixel height; use min/max for density)
 * - Loading state with compact spinner
 * - Use in responsive grids; parent should use min-h/max-h or % height for best behavior
 */
import React, { useCallback, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

const defaultOpts = {
  notMerge: true,
  lazyUpdate: true,
};

export function BaseChart({
  option,
  loading = false,
  className,
  style,
  minHeight = 200,
  maxHeight = 380,
  onChartReady,
  ...rest
}) {
  const chartRef = useRef(null);

  const onEvents = useCallback(
    (chart) => {
      if (typeof onChartReady === 'function') onChartReady(chart);
    },
    [onChartReady]
  );

  if (loading) {
    return (
      <div
        className={cn('flex items-center justify-center bg-muted/20 rounded-lg', className)}
        style={{
          minHeight: typeof minHeight === 'number' ? `${minHeight}px` : minHeight,
          maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight,
          ...style,
        }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const minH = typeof minHeight === 'number' ? `${minHeight}px` : minHeight;
  const maxH = typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight;

  return (
    <div
      className={cn('w-full overflow-hidden rounded-lg', className)}
      style={{
        minHeight: minH,
        maxHeight: maxH,
        height: '100%',
        ...style,
      }}
    >
      <ReactECharts
        ref={chartRef}
        option={option}
        notMerge={defaultOpts.notMerge}
        lazyUpdate={defaultOpts.lazyUpdate}
        style={{ width: '100%', height: '100%', minHeight: minH }}
        opts={{ renderer: 'canvas' }}
        onEvents={onChartReady ? { ready: onEvents } : undefined}
        {...rest}
      />
    </div>
  );
}

export default BaseChart;
