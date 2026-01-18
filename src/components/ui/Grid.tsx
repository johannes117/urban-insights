import type { ReactNode } from 'react'

interface GridProps {
  element: {
    props: {
      columns?: number
    }
  }
  children?: ReactNode
}

export function Grid({ element, children }: GridProps) {
  const columns = element.props.columns ?? 2

  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  )
}
