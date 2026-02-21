import * as React from "react"
import { cn } from "../../lib/utils"

/** Explicit Tailwind classes so JIT includes them. 1 col mobile, 2 tablet, 3-4 desktop. */
const COLS_MAP = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
}
const SM_COLS = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4", 5: "sm:grid-cols-5" }
const MD_COLS = { 1: "md:grid-cols-1", 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4", 5: "md:grid-cols-5" }
const LG_COLS = { 1: "lg:grid-cols-1", 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5" }

const DashboardGrid = ({
  children,
  className,
  cols = { default: 1, sm: 2, md: 3, lg: 4 },
}) => {
  const d = cols.default ?? 1
  const sm = cols.sm ?? d
  const md = cols.md ?? sm
  const lg = cols.lg ?? md
  return (
    <div
      className={cn(
        "grid gap-3 sm:gap-4",
        COLS_MAP[d] ?? "grid-cols-1",
        sm !== d && SM_COLS[sm],
        md !== sm && MD_COLS[md],
        lg !== md && LG_COLS[lg],
        className
      )}
    >
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

