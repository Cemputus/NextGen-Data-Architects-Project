/**
 * PageHeader — Consistent page title, description, and actions across all roles.
 * Design system: page title text-xl sm:text-2xl font-semibold; description text-sm text-muted-foreground.
 */
import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '../../lib/utils';

const Breadcrumbs = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  if (pathnames.length === 0) return null;

  return (
    <nav className="flex items-center space-x-1 underline-offset-4 mb-2 overflow-hidden">
      <Link
        to="/"
        className="text-[10px] font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 shrink-0"
      >
        <Home className="h-2.5 w-2.5" />
        Home
      </Link>
      {pathnames.map((value, index) => {
        const last = index === pathnames.length - 1;
        const to = `/${pathnames.slice(0, index + 1).join('/')}`;
        const label = value.charAt(0).toUpperCase() + value.slice(1).replace(/-/g, ' ');

        return (
          <React.Fragment key={to}>
            <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/50 shrink-0" />
            {last ? (
              <span className="text-[10px] font-semibold text-primary/80 truncate max-w-[120px]">
                {label}
              </span>
            ) : (
              <Link
                to={to}
                className="text-[10px] font-medium text-muted-foreground hover:text-primary transition-colors truncate max-w-[120px]"
              >
                {label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

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
        'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4',
        className
      )}
      {...props}
    >
      <div className="min-w-0">
        <Breadcrumbs />
        {title && (
          <h1 className="text-xl font-bold tracking-tight text-foreground truncate sm:text-2xl lg:text-3xl">
            {title}
          </h1>
        )}
        {desc && (
          <p className="mt-1 text-sm text-muted-foreground/90 font-medium">
            {desc}
          </p>
        )}
      </div>
      {actionsContent && (
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2 pt-6 sm:pt-4">
          {actionsContent}
        </div>
      )}
    </div>
  );
};

const PageContent = ({ children, className, ...props }) => (
  <div className={cn('space-y-4', className)} {...props}>
    {children}
  </div>
);

export { PageHeader, PageContent };
