'use client'

import {
  BarChart as RechartsBarChart,
  Bar,
  LineChart as RechartsLineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { ReportSection } from '../lib/types'

interface ReportSectionRendererProps {
  section: ReportSection
  data: Record<string, unknown>
}

const CHART_COLORS = ['#374151', '#6b7280', '#9ca3af', '#d1d5db', '#e5e7eb']

function getDataFromPath(data: Record<string, unknown>, path?: string): Record<string, unknown>[] {
  if (!path) return []
  const cleanPath = path.replace(/^\//, '')
  const parts = cleanPath.split('/')
  let result: unknown = data
  for (const part of parts) {
    if (result && typeof result === 'object' && part in result) {
      result = (result as Record<string, unknown>)[part]
    } else {
      return []
    }
  }
  return Array.isArray(result) ? result : []
}

function ReportBarChart({
  section,
  data,
}: {
  section: ReportSection
  data: Record<string, unknown>
}) {
  const chartData = getDataFromPath(data, section.dataPath)
  if (!chartData.length || !section.xKey || !section.yKey) return null

  return (
    <div className="chart-container my-4 rounded-lg bg-gray-50 p-4">
      <ResponsiveContainer width="100%" height={200}>
        <RechartsBarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey={section.xKey}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
          <Tooltip />
          <Bar dataKey={section.yKey} fill="#374151" radius={[4, 4, 0, 0]} />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  )
}

function ReportLineChart({
  section,
  data,
}: {
  section: ReportSection
  data: Record<string, unknown>
}) {
  const chartData = getDataFromPath(data, section.dataPath)
  if (!chartData.length || !section.xKey || !section.yKey) return null

  return (
    <div className="chart-container my-4 rounded-lg bg-gray-50 p-4">
      <ResponsiveContainer width="100%" height={200}>
        <RechartsLineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey={section.xKey}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey={section.yKey}
            stroke="#374151"
            strokeWidth={2}
            dot={{ fill: '#374151', r: 4 }}
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  )
}

function ReportPieChart({
  section,
  data,
}: {
  section: ReportSection
  data: Record<string, unknown>
}) {
  const chartData = getDataFromPath(data, section.dataPath)
  if (!chartData.length || !section.nameKey || !section.valueKey) return null

  return (
    <div className="chart-container my-4 rounded-lg bg-gray-50 p-4">
      <ResponsiveContainer width="100%" height={200}>
        <RechartsPieChart>
          <Pie
            data={chartData}
            dataKey={section.valueKey}
            nameKey={section.nameKey}
            cx="50%"
            cy="50%"
            outerRadius={70}
            label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
            labelLine={{ stroke: '#9ca3af' }}
          >
            {chartData.map((_, index) => (
              <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  )
}

function ReportTable({
  section,
  data,
}: {
  section: ReportSection
  data: Record<string, unknown>
}) {
  const tableData = getDataFromPath(data, section.dataPath)
  if (!tableData.length || !section.columns?.length) return null

  return (
    <div className="table-container my-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {section.columns.map((col) => (
              <th
                key={col}
                className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-left font-semibold"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableData.slice(0, 10).map((row, rowIndex) => (
            <tr key={rowIndex}>
              {section.columns!.map((col) => {
                const value = row[col] ?? row[col.toLowerCase()] ?? ''
                return (
                  <td key={col} className="border-b border-gray-100 px-3 py-2">
                    {String(value)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ReportMetric({ section }: { section: ReportSection }) {
  return (
    <div className="metric-display my-4 inline-block rounded-lg bg-gray-100 px-6 py-4">
      <div className="metric-value text-3xl font-bold text-gray-900">{section.content}</div>
      {section.title && (
        <div className="metric-label mt-1 text-sm text-gray-600">{section.title}</div>
      )}
    </div>
  )
}

export function ReportSectionRenderer({ section, data }: ReportSectionRendererProps) {
  return (
    <div className="report-section mb-8">
      {section.title && section.type !== 'metric' && (
        <h2 className="section-title mb-3 text-lg font-semibold text-gray-900">{section.title}</h2>
      )}

      {section.type === 'text' && section.content && (
        <p className="section-content leading-relaxed text-gray-700">{section.content}</p>
      )}

      {section.type === 'metric' && <ReportMetric section={section} />}

      {section.type === 'chart' && section.chartType === 'bar' && (
        <ReportBarChart section={section} data={data} />
      )}

      {section.type === 'chart' && section.chartType === 'line' && (
        <ReportLineChart section={section} data={data} />
      )}

      {section.type === 'chart' && section.chartType === 'pie' && (
        <ReportPieChart section={section} data={data} />
      )}

      {section.type === 'table' && <ReportTable section={section} data={data} />}

      {section.source && (
        <p className="section-source mt-2 text-xs italic text-gray-500">Source: {section.source}</p>
      )}
    </div>
  )
}
