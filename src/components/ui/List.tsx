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
    if (error) {
      console.warn('[List] Skipping list render:', error)
    }
    return null
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
