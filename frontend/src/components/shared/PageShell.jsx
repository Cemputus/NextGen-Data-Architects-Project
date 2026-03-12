import React from 'react';

export const PageShell = ({
    title,
    breadcrumbs = [],
    actions,
    children,
    className = ''
}) => {
    return (
        <div className={`flex flex-col min-h-screen bg-background text-foreground ${className}`}>
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-border/40 gap-4">
                <div>
                    {breadcrumbs.length > 0 && (
                        <nav className="flex text-sm text-muted-foreground mb-2" aria-label="Breadcrumb">
                            <ol className="flex items-center space-x-2">
                                {breadcrumbs.map((crumb, idx) => (
                                    <li key={idx} className="flex items-center">
                                        {idx > 0 && <span className="mx-2 text-border">/</span>}
                                        {crumb.href ? (
                                            <a href={crumb.href} className="hover:text-foreground transition-colors">
                                                {crumb.label}
                                            </a>
                                        ) : (
                                            <span className="text-foreground font-medium">{crumb.label}</span>
                                        )}
                                    </li>
                                ))}
                            </ol>
                        </nav>
                    )}
                    <h1 className="text-page-title font-bold tracking-tight">{title}</h1>
                </div>

                {actions && (
                    <div className="flex items-center gap-2">
                        {actions}
                    </div>
                )}
            </div>

            {/* Main Content Area */}
            <main className="flex-1 py-6 w-full max-w-7xl mx-auto space-y-8 animate-fade-in">
                {children}
            </main>
        </div>
    );
};

export default PageShell;

export const SectionDivider = ({ className = '' }) => (
    <div className={`w-full h-px bg-gradient-to-r from-transparent via-border to-transparent my-10 ${className}`}></div>
);
