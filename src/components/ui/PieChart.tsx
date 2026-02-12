import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { useData } from '@json-render/react'
import { resolveDataPath } from './useChartData'

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

  const { data: items, isEmpty, error } = resolveDataPath(
    data as Record<string, unknown>,
    dataPath,
    'PieChart',
    {
      requiredKeys: [nameKey, valueKey],
      requireAllKeys: true,
    }
  )

  if (isEmpty) {
    if (error) {
      console.warn('[PieChart] Skipping chart render:', error)
    }
    return null
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsPieChart>
            <Pie
              data={items as Record<string, unknown>[]}
              dataKey={valueKey}
              nameKey={nameKey}
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {(items as unknown[]).map((_, index) => (
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
