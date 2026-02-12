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
    'Table',
    {
      requiredKeys: columns,
      requireAllKeys: false,
      requireKeyCoverage: 'all',
    }
  )

  if (isEmpty) {
    if (error) {
      console.warn('[Table] Skipping table render:', error)
    }
    return null
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
