import React from 'react';

/**
 * Animated skeleton placeholder for loading states
 */
export const LoadingSkeleton = ({ className = '', type = 'default' }) => {
    const baseClass = "animate-pulse bg-muted rounded-md";

    if (type === 'card') {
        return (
            <div className={`p-5 rounded-xl border border-border bg-card shadow-sm ${className}`}>
                <div className="flex justify-between items-start">
                    <div className="space-y-3 w-2/3">
                        <div className={`${baseClass} h-4 w-1/2`}></div>
                        <div className={`${baseClass} h-8 w-3/4`}></div>
                        <div className={`${baseClass} h-3 w-1/3`}></div>
                    </div>
                    <div className={`${baseClass} h-10 w-10 rounded-lg`}></div>
                </div>
            </div>
        );
    }

    if (type === 'chart') {
        return (
            <div className={`p-6 rounded-xl border border-border bg-card shadow-sm flex flex-col h-full min-h-[300px] ${className}`}>
                <div className="mb-6 space-y-2">
                    <div className={`${baseClass} h-5 w-1/3`}></div>
                    <div className={`${baseClass} h-3 w-1/4`}></div>
                </div>
                <div className="flex-1 flex items-end gap-2 w-full pt-4">
                    {[40, 70, 45, 90, 65, 30, 85, 55, 75, 50, 60, 80].map((h, i) => (
                        <div key={i} className={`${baseClass} flex-1 rounded-t-sm`} style={{ height: `${h}%` }}></div>
                    ))}
                </div>
            </div>
        );
    }

    if (type === 'table') {
        return (
            <div className={`rounded-xl border border-border bg-card shadow-sm overflow-hidden ${className}`}>
                <div className="p-4 border-b border-border bg-muted/30">
                    <div className={`${baseClass} h-6 w-1/4`}></div>
                </div>
                <div className="p-0">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex items-center p-4 border-b border-border gap-4">
                            <div className={`${baseClass} h-4 w-1/4`}></div>
                            <div className={`${baseClass} h-4 w-1/3`}></div>
                            <div className={`${baseClass} h-4 w-1/6`}></div>
                            <div className={`${baseClass} h-4 w-1/5 ml-auto`}></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // default type
    return <div className={`${baseClass} ${className}`}></div>;
};

export default LoadingSkeleton;
