import React from 'react';

export const UnauthorizedState = ({
    message = "You don't have permission to view this section.",
    role = null,
    className = ''
}) => {
    return (
        <div className={`w-full flex flex-col justify-center items-center p-12 text-center bg-card border border-destructive/20 border-dashed rounded-xl ${className}`}>
            <div className="bg-destructive/10 p-4 rounded-full text-destructive mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
            </div>
            <h3 className="text-lg font-semibold text-foreground">Access Restricted</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                {message}
            </p>
            {role && (
                <span className="mt-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground border border-border">
                    Current Role: {role.toUpperCase()}
                </span>
            )}
        </div>
    );
};

export default UnauthorizedState;
