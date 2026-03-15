/**
 * AlertBanner — Design-system alert for inline messages (info, success, warning, error).
 * Use for page-level or section-level notices. Supports dismiss and optional action.
 */
import * as React from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '../../lib/utils';

const variantStyles = {
  info: 'border-primary/30 bg-primary/5 text-foreground',
  success: 'border-success/40 bg-success/10 text-foreground',
  warning: 'border-warning/40 bg-warning/10 text-foreground',
  error: 'border-destructive/40 bg-destructive/10 text-destructive',
};

const iconMap = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
};

export function AlertBanner({
  variant = 'info',
  title,
  children,
  onDismiss,
  action,
  className,
  ...props
}) {
  const Icon = iconMap[variant] || Info;
  const style = variantStyles[variant] || variantStyles.info;

  return (
    <div
      role="alert"
      className={cn(
        'rounded-lg border px-4 py-3 flex items-start gap-3',
        style,
        className
      )}
      {...props}
    >
      <Icon className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold text-sm">{title}</p>}
        <div className="text-sm mt-0.5">{children}</div>
        {action && <div className="mt-3">{action}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded p-1 hover:bg-black/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export default AlertBanner;
