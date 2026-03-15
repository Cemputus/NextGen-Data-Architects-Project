/**
 * Enterprise design tokens — single source for spacing, chart palette, and shared constants.
 * Use these in components and charts for consistent UI/UX across all roles.
 */

/** Spacing scale (Tailwind-aligned): 0, 1(4px), 2(8px), 3(12px), 4(16px), 5(20px), 6(24px), 8(32px), 10(40px), 12(48px), 16(64px), 20(80px), 24(96px) */
export const SPACING = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
  '6xl': 80,
  '7xl': 96,
};

/** Chart color palette — use for ECharts, Recharts, and any data viz. Accessible and distinct. */
export const CHART_PALETTE = [
  '#2563eb', // primary blue
  '#7c3aed', // accent purple
  '#059669', // success green
  '#ea580c', // warning orange
  '#dc2626', // destructive red
  '#0891b2', // cyan
  '#ca8a04', // gold
  '#db2777', // pink
  '#4f46e5', // indigo
  '#0d9488', // teal
];

/** Chart palette for sequential/trend (e.g. single metric over time). */
export const CHART_PALETTE_SEQUENTIAL = [
  '#3b82f6',
  '#60a5fa',
  '#93c5fd',
  '#bfdbfe',
  '#dbeafe',
];

/** Semantic colors (hex) for use in non-CSS-in-JS contexts (e.g. chart labels). */
export const SEMANTIC_COLORS = {
  primary: '#1e293b',
  accent: '#7c3aed',
  success: '#16a34a',
  warning: '#ea580c',
  destructive: '#dc2626',
  muted: '#64748b',
};

export default {
  SPACING,
  CHART_PALETTE,
  CHART_PALETTE_SEQUENTIAL,
  SEMANTIC_COLORS,
};
