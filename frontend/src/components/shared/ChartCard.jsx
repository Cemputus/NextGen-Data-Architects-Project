import React from 'react';

/**
 * Enterprise Chart wrapper component.
 */
export const ChartCard = ({
    title,
    subtitle,
    loading = false,
    error = null,
    isEmpty = false,
    onExport,
    children,
    className = ''
}) => {
    return (
        <div className={`bg-card text-card-foreground rounded-xl border border-border shadow-sm flex flex-col h-full ${className}`}>
            <div className="p-6 pb-2 flex justify-between items-start">
                <div>
                    <h3 className="text-card-title">{title}</h3>
                    {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
                </div>
                {onExport && (
                    <button
                        onClick={onExport}
                        className="text-muted-foreground hover:text-foreground hover:bg-secondary p-1.5 rounded-md transition-colors"
                        title="Export Data"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                    </button>
                )}
            </div>

            <div className="p-6 pt-0 flex-1 flex flex-col relative min-h-[250px]">
                {loading ? (
                    <div className="w-full h-full min-h-[200px] flex items-center justify-center bg-secondary/30 rounded-lg animate-pulse">
                        <span className="text-muted-foreground text-sm flex items-center gap-2">
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Loading data...
                        </span>
                    </div>
                ) : error ? (
                    <div className="w-full h-full min-h-[200px] flex flex-col items-center justify-center text-center p-4">
                        <div className="text-destructive mb-2 bg-destructive/10 p-3 rounded-full">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                        </div>
                        <p className="font-medium text-foreground">Failed to load chart</p>
                        <p className="text-sm text-muted-foreground mt-1 max-w-[80%]">{error.message || String(error)}</p>
                    </div>
                ) : isEmpty ? (
                    <div className="w-full h-full min-h-[200px] flex flex-col items-center justify-center text-center p-4">
                        <div className="text-muted-foreground mb-2 bg-secondary/50 p-3 rounded-full">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                        </div>
                        <p className="font-medium text-foreground">No data available</p>
                        <p className="text-sm text-muted-foreground mt-1">There are no records matching the current filters.</p>
                    </div>
                ) : (
                    <div className="w-full h-full flex-1 relative flex">
                        {children}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChartCard;
