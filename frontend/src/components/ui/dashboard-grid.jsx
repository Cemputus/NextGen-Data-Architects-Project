import * as React from "react"
import { cn } from "../../lib/utils"

const DashboardGrid = ({ 
  children, 
  className,
  cols = { default: 1, sm: 2, md: 3, lg: 4 }
}) => {
  return (
    <div className={cn(
      "grid gap-4",
      `grid-cols-${cols.default}`,
      `sm:grid-cols-${cols.sm}`,
      `md:grid-cols-${cols.md}`,
      `lg:grid-cols-${cols.lg}`,
      className
    )}>
      {children}
    </div>
  )
}

const DashboardSection = ({ title, description, children, className }) => {
  return (
    <div className={cn("space-y-4", className)}>
      {(title || description) && (
        <div>
          {title && <h3 className="text-lg font-semibold">{title}</h3>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}
      {children}
    </div>
  )
}

export { DashboardGrid, DashboardSection }

