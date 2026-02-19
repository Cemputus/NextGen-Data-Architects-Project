import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./card"
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
    if (changeType === "positive") return <TrendingUp className="h-4 w-4 text-green-500" />
    if (changeType === "negative") return <TrendingDown className="h-4 w-4 text-red-500" />
    return <Minus className="h-4 w-4 text-gray-400" />
  }

  const getChangeColor = () => {
    if (changeType === "positive") return "text-green-600"
    if (changeType === "negative") return "text-red-600"
    return "text-gray-600"
  }

  return (
    <Card className={cn("hover:shadow-lg transition-shadow", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
        {change !== undefined && change !== null && (
          <div className={cn("flex items-center text-xs mt-2", getChangeColor())}>
            {getTrendIcon()}
            <span className="ml-1">{change}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export { KPICard }

