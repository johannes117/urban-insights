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
    'PieChart'
  )

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">{title}</h3>
      <div className="h-64">
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center text-gray-500">
            <svg className="mb-2 h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
            </svg>
            <p className="text-sm">{error || 'No data available'}</p>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  )
}
