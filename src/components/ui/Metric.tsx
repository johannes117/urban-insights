import { ArrowUp, ArrowDown, Minus } from 'lucide-react'

interface MetricProps {
  element: {
    props: {
      label: string
      value: string
      trend?: 'up' | 'down' | 'flat'
    }
  }
}

export function Metric({ element }: MetricProps) {
  const { label, value, trend } = element.props

  const trendIcon = {
    up: <ArrowUp className="h-4 w-4 text-green-500" />,
    down: <ArrowDown className="h-4 w-4 text-red-500" />,
    flat: <Minus className="h-4 w-4 text-gray-400" />,
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {trend && trendIcon[trend]}
      </div>
    </div>
  )
}
