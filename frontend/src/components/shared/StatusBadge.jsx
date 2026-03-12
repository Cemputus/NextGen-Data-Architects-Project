import React from 'react';

/**
 * Universal status badge component for consistent color-coding
 */
export const StatusBadge = ({ status, className = '' }) => {
    if (!status) return null;

    const statusStr = String(status).toUpperCase();

    let colorClass = "bg-secondary text-secondary-foreground"; // default

    // Maps statuses to colors
    if (['COMPLETED', 'ACTIVE', 'PASSED', 'PAID', 'SUCCESS', 'ON_TRACK'].includes(statusStr)) {
        colorClass = "bg-success/15 text-success border border-success/30";
    } else if (['FCW', 'FAILED', 'RETAKE_REQUIRED', 'HIGH_RISK', 'OUTSTANDING', 'DROPOUT'].includes(statusStr)) {
        colorClass = "bg-destructive/15 text-destructive border border-destructive/30";
    } else if (['FEX', 'MEX', 'PENDING', 'AT_RISK', 'WARNING', 'LATE', 'PARTIAL'].includes(statusStr)) {
        colorClass = "bg-warning/20 text-warning-foreground border border-warning/30";
    } else if (['IN_PROGRESS', 'ENROLLED', 'SPONSORED', 'NEW'].includes(statusStr)) {
        colorClass = "bg-accent/15 text-accent border border-accent/30";
    } else if (['WITHDRAWN', 'INACTIVE', 'NULL', 'UNKNOWN', 'N/A'].includes(statusStr)) {
        colorClass = "bg-muted text-muted-foreground border border-border";
    } else if (statusStr === 'NORMAL') {
        colorClass = "bg-primary/10 text-primary border border-primary/20";
    }

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${colorClass} ${className}`}>
            {status}
        </span>
    );
};

export default StatusBadge;
