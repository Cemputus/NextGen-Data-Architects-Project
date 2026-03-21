import * as React from "react"
import { Card, CardContent } from "./card"
import { cn } from "../../lib/utils"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

const KPICard = ({ 
  title, 
  value, 
  change, 
  changeType = "neutral", 
  icon: Icon, 
  subtitle,
  className 
}) => {
  const getTrendIcon = () => {
    if (changeType === "positive") return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
    if (changeType === "negative") return <TrendingDown className="h-3.5 w-3.5 text-red-500" />
    return <Minus className="h-3.5 w-3.5 text-muted-foreground/70" />
  }

  const getChangeColor = () => {
    if (changeType === "positive") return "text-emerald-600 dark:text-emerald-400"
    if (changeType === "negative") return "text-red-600 dark:text-red-400"
    return "text-muted-foreground"
  }

  return (
    <Card
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm",
        "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/30",
        "dark:bg-gradient-to-br dark:from-card dark:to-card/90",
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/0 via-primary/40 to-primary/0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        aria-hidden
      />
      <CardContent className="p-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-medium leading-tight text-muted-foreground">
              {title}
            </p>
            <div className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
              {value}
            </div>
            {subtitle && (
              <p className="text-[11px] leading-snug text-muted-foreground/90">
                {subtitle}
              </p>
            )}
            {change !== undefined && change !== null && (
              <div className={cn("flex items-center gap-1 pt-1 text-xs font-medium", getChangeColor())}>
                {getTrendIcon()}
                <span>{change}</span>
              </div>
            )}
          </div>
          {Icon && (
            <div
              className={cn(
                "flex shrink-0 rounded-xl bg-primary/10 p-2.5 ring-1 ring-primary/10",
                "transition-colors duration-200 group-hover:bg-primary/[0.14] group-hover:ring-primary/20"
              )}
            >
              <Icon className="h-5 w-5 text-primary" aria-hidden />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export { KPICard }
