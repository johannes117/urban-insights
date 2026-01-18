import { useData } from '@json-render/react'

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

  const pathParts = dataPath.replace(/^\//, '').split('/')
  let tableData = data as Record<string, unknown>
  for (const part of pathParts) {
    tableData = tableData?.[part] as Record<string, unknown>
  }

  const rows = Array.isArray(tableData) ? tableData : []

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
          {rows.map((row, idx) => (
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
