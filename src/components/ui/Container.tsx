'use client'

import type { ReactNode } from 'react'

interface ContainerProps {
  element: {
    type: string
    props?: {
      className?: string
    }
  }
  children?: ReactNode
}

export function Container({ element, children }: ContainerProps) {
  return <div className={element.props?.className}>{children}</div>
}
