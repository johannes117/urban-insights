'use client'

import { useMemo } from 'react'
import { Renderer, DataProvider, ActionProvider, VisibilityProvider } from '@json-render/react'
import type { UITree, UIElement } from '@json-render/core'
import { componentRegistry } from './ui/registry'
import type { NestedUIElement, QueryResult } from '../lib/types'

interface JsonRenderViewProps {
  ui: NestedUIElement
  queryResults?: QueryResult[]
}

function nestedToFlat(nested: NestedUIElement): UITree {
  const elements: Record<string, UIElement> = {}
  let keyCounter = 0

  function processElement(el: NestedUIElement, parentKey: string | null = null): string {
    const key = `el_${keyCounter++}`
    const childKeys: string[] = []

    if (el.children && Array.isArray(el.children)) {
      for (const child of el.children) {
        const childKey = processElement(child, key)
        childKeys.push(childKey)
      }
    }

    elements[key] = {
      key,
      type: el.type,
      props: el.props || {},
      children: childKeys.length > 0 ? childKeys : undefined,
      parentKey,
    }

    return key
  }

  const rootKey = processElement(nested)

  return {
    root: rootKey,
    elements,
  }
}

export default function JsonRenderView({ ui, queryResults = [] }: JsonRenderViewProps) {
  const flatTree = nestedToFlat(ui)

  const data = useMemo(() => {
    const merged: Record<string, unknown> = {}
    for (const result of queryResults) {
      merged[result.resultKey] = result.data
    }
    return merged
  }, [queryResults])

  const handleAction = (actionName: string) => {
    if (actionName === 'refresh') {
      window.location.reload()
    }
    if (actionName === 'export') {
      alert('Export functionality coming soon!')
    }
  }

  return (
    <DataProvider initialData={data}>
      <VisibilityProvider>
        <ActionProvider
          actions={{
            refresh: () => handleAction('refresh'),
            export: () => handleAction('export'),
          }}
        >
          <Renderer tree={flatTree} registry={componentRegistry} />
        </ActionProvider>
      </VisibilityProvider>
    </DataProvider>
  )
}
