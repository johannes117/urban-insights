import { useData } from '@json-render/react'
import { resolveDataPath } from './useChartData'

interface ListProps {
  element: {
    props: {
      dataPath: string
      itemTemplate: string
    }
  }
}

export function List({ element }: ListProps) {
  const { dataPath, itemTemplate } = element.props
  const { data } = useData()

  const { data: items, isEmpty, error } = resolveDataPath(
    data as Record<string, unknown>,
    dataPath,
    'List'
  )

  const renderItem = (item: Record<string, unknown>) => {
    return itemTemplate.replace(/\{(\w+)\}/g, (_, key) => String(item[key] ?? ''))
  }

  if (isEmpty) {
    return (
      <div className="flex h-24 flex-col items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500">
        <svg className="mb-2 h-8 w-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
        <p className="text-sm">{error || 'No data available'}</p>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
      {(items as unknown[]).map((item, idx) => (
        <li key={idx} className="px-4 py-3 text-sm text-gray-700">
          {renderItem(item as Record<string, unknown>)}
        </li>
      ))}
    </ul>
  )
}
