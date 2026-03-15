/**
 * Skeleton — Design-system loading placeholder for content (cards, tables, text lines).
 * Use while data is loading to reduce layout shift and perceived wait.
 */
import * as React from 'react';
import { cn } from '../../lib/utils';

export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-muted',
        className
      )}
      aria-hidden
      {...props}
    />
  );
}

/** Pre-built patterns for common layouts */
export function SkeletonLine({ className }) {
  return <Skeleton className={cn('h-4 w-full', className)} />;
}

export function SkeletonCard({ className }) {
  return (
    <div className={cn('rounded-xl border border-border p-5 space-y-3', className)}>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4, className }) {
  return (
    <div className={cn('rounded-lg border border-border overflow-hidden', className)}>
      <div className="flex gap-4 px-4 py-3 border-b border-border bg-muted/30">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 px-4 py-3">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Skeleton;
