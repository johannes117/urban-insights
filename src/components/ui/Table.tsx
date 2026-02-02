import { useData } from '@json-render/react'
import { resolveDataPath } from './useChartData'

interface TableProps {
  element: {
    props: {
      columns: string[]
      dataPath: string
    }
  }
}

export function Table({ element }: TableProps) {
  const { columns, dataPath } = element.props
  const { data } = useData()

  const { data: rows, isEmpty, error } = resolveDataPath(
    data as Record<string, unknown>,
    dataPath,
    'Table'
  )

  if (isEmpty) {
    return (
      <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500">
        <svg className="mb-2 h-8 w-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <p className="text-sm">{error || 'No data available'}</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {(rows as unknown[]).map((row, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              {columns.map((col) => (
                <td key={col} className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                  {String((row as Record<string, unknown>)[col.toLowerCase()] ?? (row as Record<string, unknown>)[col] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
