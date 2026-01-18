import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useData } from '@json-render/react'

interface LineChartProps {
  element: {
    props: {
      title: string
      dataPath: string
      xKey: string
      yKey: string
    }
  }
}

export function LineChart({ element }: LineChartProps) {
  const { title, dataPath, xKey, yKey } = element.props
  const { data } = useData()

  const pathParts = dataPath.replace(/^\//, '').split('/')
  let chartData = data as Record<string, unknown>
  for (const part of pathParts) {
    chartData = chartData?.[part] as Record<string, unknown>
  }

  const items = Array.isArray(chartData) ? chartData : []

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsLineChart data={items} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey={xKey} tick={{ fill: '#6b7280', fontSize: 12 }} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
              }}
            />
            <Line
              type="monotone"
              dataKey={yKey}
              stroke="#111827"
              strokeWidth={2}
              dot={{ fill: '#111827', strokeWidth: 2 }}
            />
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
