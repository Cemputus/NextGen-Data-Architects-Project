import React from 'react';

export const AnalyticSection = ({
    title,
    subtitle,
    actions,
    children,
    className = ''
}) => {
    return (
        <div className={`mt-8 mb-4 flex flex-col gap-6 ${className}`}>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-section-title text-foreground">{title}</h2>
                    {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
                </div>
                {actions && (
                    <div className="flex items-center gap-2">
                        {actions}
                    </div>
                )}
            </div>

            <div className="w-full h-px bg-border/60"></div>

            <div className="w-full">
                {children}
            </div>
        </div>
    );
};

export default AnalyticSection;
