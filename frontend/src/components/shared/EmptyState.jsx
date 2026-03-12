import React from 'react';

export const EmptyState = ({
    icon,
    title,
    description,
    action,
    className = ''
}) => {
    return (
        <div className={`w-full flex flex-col justify-center items-center p-12 text-center bg-card border border-dashed border-border rounded-xl ${className}`}>
            <div className="bg-secondary/50 p-4 rounded-full text-muted-foreground mb-4">
                {icon || (
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                )}
            </div>
            <h3 className="text-lg font-semibold text-foreground">{title || 'No Data Available'}</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-2 mb-6">
                {description || "We couldn't find any data matching your current filters or selection. Try adjusting your parameters."}
            </p>
            {action && (
                <div className="mt-2">
                    {action}
                </div>
            )}
        </div>
    );
};

export default EmptyState;
