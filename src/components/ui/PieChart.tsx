import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { useData } from '@json-render/react'

interface PieChartProps {
  element: {
    props: {
      title: string
      dataPath: string
      nameKey: string
      valueKey: string
    }
  }
}

const COLORS = ['#111827', '#374151', '#6b7280', '#9ca3af', '#d1d5db']

export function PieChart({ element }: PieChartProps) {
  const { title, dataPath, nameKey, valueKey } = element.props
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
          <RechartsPieChart>
            <Pie
              data={items}
              dataKey={valueKey}
              nameKey={nameKey}
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {items.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
              }}
            />
            <Legend />
          </RechartsPieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
