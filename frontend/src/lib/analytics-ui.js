import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const kpiStripCardClass = 'rounded-xl border bg-card text-card-foreground shadow-sm p-4';

export function chartSurfaceCard(extra = '') {
  return twMerge(clsx('rounded-xl border bg-card text-card-foreground shadow-sm', extra));
}

export const chartCardHeaderClass = 'flex flex-col space-y-1 p-4 pb-2';
export const chartCardTitleClass = 'text-sm font-semibold leading-none tracking-tight';
export const chartCardDescriptionClass = 'text-xs text-muted-foreground';
export const chartEmptyStateClass = 'flex items-center justify-center h-40 text-sm text-muted-foreground';
