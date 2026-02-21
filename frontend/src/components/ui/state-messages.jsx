/**
 * Shared loading, empty, and error states — design-system consistent across the app.
 */
import * as React from 'react';
import { Loader2, Inbox, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

/** Loading: spinner + optional message */
export function LoadingState({ message = 'Loading...', className }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-8 gap-3 text-muted-foreground',
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      {message && <p className="text-sm">{message}</p>}
    </div>
  );
}

/** Empty: icon + message + optional action */
export function EmptyState({ message = 'No data available.', hint, action, icon: Icon = Inbox, className }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-8 px-4 text-center text-muted-foreground',
        className
      )}
    >
      <Icon className="h-10 w-10 mb-3 opacity-50" aria-hidden />
      <p className="text-sm font-medium">{message}</p>
      {hint && <p className="text-xs mt-1">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Error: message + optional retry action */
export function ErrorState({ message, retry, className }) {
  return (
    <div
      className={cn(
        'rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-4 text-destructive',
        className
      )}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{message}</p>
          {retry && (
            <button
              type="button"
              onClick={retry}
              className="mt-2 text-sm font-medium underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
