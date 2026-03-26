/**
 * Shared ECharts theme tokens used across all chart components.
 */

export const UCU_COLORS = {
  blue: '#2563eb',
  purple: '#7c3aed',
  green: '#059669',
  orange: '#ea580c',
  red: '#dc2626',
  cyan: '#0891b2',
  gold: '#ca8a04',
  pink: '#db2777',
  indigo: '#4f46e5',
  teal: '#0d9488',
};

export const CHART_PALETTE_THEME = [
  '#2563eb',
  '#7c3aed',
  '#059669',
  '#ea580c',
  '#dc2626',
  '#0891b2',
  '#ca8a04',
  '#db2777',
  '#4f46e5',
  '#0d9488',
];

export const MODERN_CHART_PALETTE = [
  '#3b82f6',
  '#8b5cf6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
  '#f97316',
  '#ec4899',
  '#6366f1',
  '#14b8a6',
];

export const defaultTextStyle = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 12,
  color: '#64748b',
};

export const defaultTitleTextStyle = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 13,
  fontWeight: 600,
  color: '#1e293b',
};

export const defaultGrid = {
  top: 32,
  right: 16,
  bottom: 40,
  left: 48,
  containLabel: true,
};

export const defaultTooltip = {
  trigger: 'axis',
  backgroundColor: '#1e293b',
  borderColor: '#334155',
  borderWidth: 1,
  textStyle: { color: '#f1f5f9', fontSize: 12 },
  confine: true,
};

export function formatTooltipValue(value, isPercent = false) {
  if (value == null) return '—';
  if (isPercent) return `${Number(value).toFixed(1)}%`;
  if (Number.isInteger(value)) return value.toLocaleString();
  return Number(value).toFixed(2);
}
