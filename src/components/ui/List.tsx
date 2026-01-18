import { useData } from '@json-render/react'

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
  const data = useData()

  const pathParts = dataPath.replace(/^\//, '').split('/')
  let listData = data as Record<string, unknown>
  for (const part of pathParts) {
    listData = listData?.[part] as Record<string, unknown>
  }

  const items = Array.isArray(listData) ? listData : []

  const renderItem = (item: Record<string, unknown>) => {
    return itemTemplate.replace(/\{(\w+)\}/g, (_, key) => String(item[key] ?? ''))
  }

  return (
    <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
      {items.map((item, idx) => (
        <li key={idx} className="px-4 py-3 text-sm text-gray-700">
          {renderItem(item as Record<string, unknown>)}
        </li>
      ))}
    </ul>
  )
}
