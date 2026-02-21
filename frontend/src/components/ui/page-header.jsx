/**
 * PageHeader — Consistent page title, description, and actions across all roles.
 * Design system: page title text-xl sm:text-2xl font-semibold; description text-sm text-muted-foreground.
 */
import * as React from 'react';
import { cn } from '../../lib/utils';

const PageHeader = ({
  title,
  description,
  subtitle,
  actions,
  children,
  className,
  ...props
}) => {
  const desc = description ?? subtitle;
  const actionsContent = actions ?? children;
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
      {...props}
    >
      <div className="min-w-0">
        {title && (
          <h1 className="text-xl font-semibold tracking-tight text-foreground truncate sm:text-2xl">
            {title}
          </h1>
        )}
        {desc && (
          <p className="mt-0.5 text-sm text-muted-foreground">
            {desc}
          </p>
        )}
      </div>
      {actionsContent && <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actionsContent}</div>}
    </div>
  );
};

const PageContent = ({ children, className, ...props }) => (
  <div className={cn('space-y-4', className)} {...props}>
    {children}
  </div>
);

export { PageHeader, PageContent };
