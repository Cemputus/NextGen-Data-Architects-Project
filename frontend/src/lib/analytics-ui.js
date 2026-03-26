/**
 * Shared CSS class strings for dashboard cards and chart surfaces.
 * Used across role dashboards for consistent styling.
 */
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/** Strip card used for KPI rows */
export const kpiStripCardClass = 'rounded-xl border bg-card text-card-foreground shadow-sm p-4';

/** Surface card wrapping a chart */
export function chartSurfaceCard(extra = '') {
  return cn('rounded-xl border bg-card text-card-foreground shadow-sm', extra);
}

/** Card header spacing */
export const chartCardHeaderClass = 'flex flex-col space-y-1 p-4 pb-2';

/** Card title text */
export const chartCardTitleClass = 'text-sm font-semibold leading-none tracking-tight';

/** Card description / subtitle text */
export const chartCardDescriptionClass = 'text-xs text-muted-foreground';

/** Empty-state message inside a chart card */
export const chartEmptyStateClass = 'flex items-center justify-center h-40 text-sm text-muted-foreground';
