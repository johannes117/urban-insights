import type { ReactNode } from 'react'

interface CardProps {
  element: {
    props: {
      title: string
    }
  }
  children?: ReactNode
}

export function Card({ element, children }: CardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-lg font-semibold text-gray-900">
        {element.props.title}
      </h3>
      <div>{children}</div>
    </div>
  )
}
