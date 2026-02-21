/**
 * Modal — Design-system dialog: max-w (lg/xl), max-h-[90vh] overflow-y-auto, aria-modal.
 * Use for forms and confirmations; ensure title id for aria-labelledby.
 */
import * as React from 'react';
import { cn } from '../../lib/utils';

const Modal = ({
  open,
  onClose,
  title,
  titleId = 'modal-title',
  maxWidth = 'max-w-lg',
  children,
  className,
  ...props
}) => {
  React.useEffect(() => {
    if (!open) return;
    const handleEscape = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId || undefined}
    >
      <div
        className={cn(
          'bg-card rounded-xl shadow-xl border border-border w-full max-h-[90vh] overflow-y-auto',
          maxWidth,
          className
        )}
        onClick={(e) => e.stopPropagation()}
        {...props}
      >
        {children}
      </div>
    </div>
  );
};

const ModalHeader = ({ title, titleId = 'modal-title', onClose, children, className, ...props }) => (
  <div className={cn('flex items-center justify-between p-4 border-b border-border', className)} {...props}>
    <div className="min-w-0">
      {title && <h3 id={titleId} className="text-lg font-semibold text-foreground truncate">{title}</h3>}
      {children}
    </div>
    {onClose && (
      <button
        type="button"
        onClick={onClose}
        className="ml-2 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Close"
      >
        <span className="sr-only">Close</span>
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    )}
  </div>
);

const ModalBody = ({ children, className, ...props }) => (
  <div className={cn('p-4', className)} {...props}>{children}</div>
);

const ModalFooter = ({ children, className, ...props }) => (
  <div className={cn('flex gap-2 justify-end p-4 border-t border-border', className)} {...props}>{children}</div>
);

export { Modal, ModalHeader, ModalBody, ModalFooter };
