/**
 * FilterChips — Visible active filters as removable chips.
 * Use next to FilterBar or above DataTable. Supports clear one or clear all.
 */
import React from 'react';

const defaultLabel = (key, value) => {
  if (value === 'all' || value === '' || value == null) return null;
  return `${String(key).replace(/_/g, ' ')}: ${value}`;
};

export const FilterChips = ({
  filters = {},
  labels = {},
  onRemove,
  onClearAll,
  getLabel = defaultLabel,
  className = ''
}) => {
  const entries = Object.entries(filters).filter(
    ([, value]) => value !== 'all' && value !== '' && value != null
  );

  if (entries.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Active filters:
      </span>
      {entries.map(([key, value]) => {
        const label = labels[key] ?? getLabel(key, value);
        if (!label) return null;
        return (
          <span
            key={key}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary text-foreground text-xs font-medium border border-border"
          >
            {label}
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(key)}
                className="rounded p-0.5 hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Remove ${label}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </span>
        );
      })}
      {onClearAll && entries.length > 0 && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs font-medium text-muted-foreground hover:text-foreground underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          Clear all
        </button>
      )}
    </div>
  );
};

export default FilterChips;
