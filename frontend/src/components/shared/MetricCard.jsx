import React from 'react';

const variantConfig = {
    primary: {
        bg: 'bg-primary/10',
        iconBg: 'bg-primary/20',
        iconColor: 'text-primary',
        border: 'border-primary/20',
    },
    accent: {
        bg: 'bg-accent/10',
        iconBg: 'bg-accent/20',
        iconColor: 'text-accent',
        border: 'border-accent/20',
    },
    success: {
        bg: 'bg-success/10',
        iconBg: 'bg-success/20',
        iconColor: 'text-success',
        border: 'border-success/20',
    },
    destructive: {
        bg: 'bg-destructive/10',
        iconBg: 'bg-destructive/20',
        iconColor: 'text-destructive',
        border: 'border-destructive/20',
    },
    warning: {
        bg: 'bg-warning/10',
        iconBg: 'bg-warning/20',
        iconColor: 'text-warning',
        border: 'border-warning/20',
    },
    default: {
        bg: 'bg-card',
        iconBg: 'bg-secondary',
        iconColor: 'text-muted-foreground',
        border: 'border-border',
    }
};

/**
 * Enterprise KPI tile component.
 * 
 * @param {string} title KPI Label
 * @param {string|number} value KPI Value
 * @param {React.ReactNode} icon Icon to display
 * @param {string} trend 'up', 'down', 'neutral' or null
 * @param {string} trendValue Text to display next to trend (e.g. '+2.5%')
 * @param {string} variant 'primary', 'accent', 'success', 'destructive', 'warning', 'default'
 * @param {string} subtext Optional small text below value
 */
export const MetricCard = ({
    title,
    value,
    icon,
    trend,
    trendValue,
    variant = 'default',
    subtext,
    className = ''
}) => {
    const config = variantConfig[variant] || variantConfig.default;

    return (
        <div className={`p-5 rounded-xl border ${config.border} shadow-sm ${config.bg} hover-lift transition-all ${className}`}>
            <div className="flex justify-between items-start">
                <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">{title}</p>
                    <div className="flex items-baseline space-x-2">
                        <h3 className="text-2xl font-bold tracking-tight text-foreground">{value}</h3>
                        {trend && (
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${trend === 'up' ? 'text-success bg-success/10' :
                                    trend === 'down' ? 'text-destructive bg-destructive/10' :
                                        'text-muted-foreground bg-secondary'
                                }`}>
                                {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
                            </span>
                        )}
                    </div>
                    {subtext && (
                        <p className="text-xs text-muted-foreground mt-1">{subtext}</p>
                    )}
                </div>

                {icon && (
                    <div className={`p-2.5 rounded-lg ${config.iconBg} ${config.iconColor}`}>
                        {icon}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MetricCard;
