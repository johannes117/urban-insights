'use client'

import { useMemo, useRef } from 'react'
import { Renderer, DataProvider, ActionProvider, VisibilityProvider } from '@json-render/react'
import type { UITree, UIElement } from '@json-render/core'
import { componentRegistry } from './ui/registry'
import type { NestedUIElement, QueryResult } from '../lib/types'
import { sanitizeArtifactContent } from '../lib/renderability'

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
  const { ui: renderableUi, data } = useMemo(() => {
    return sanitizeArtifactContent({
      ui,
      queryResults,
    })
  }, [queryResults, ui])

  const dataVersionRef = useRef(0)
  const prevDataRef = useRef<Record<string, unknown> | null>(null)
  if (prevDataRef.current !== data) {
    prevDataRef.current = data
    dataVersionRef.current++
  }

  const flatTree = useMemo(() => {
    if (!renderableUi) return null
    return nestedToFlat(renderableUi)
  }, [renderableUi])

  if (!flatTree) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        No renderable visualization data was returned for this result.
      </div>
    )
  }

  const handleAction = (actionName: string) => {
    if (actionName === 'refresh') {
      window.location.reload()
    }
    if (actionName === 'export') {
      alert('Export functionality coming soon!')
    }
  }

  const ActionProviderWithActions = ActionProvider as React.ComponentType<{
    children: React.ReactNode
    actions: Record<string, () => void>
  }>

  return (
    <DataProvider key={dataVersionRef.current} initialData={data}>
      <VisibilityProvider>
        <ActionProviderWithActions
          actions={{
            refresh: () => handleAction('refresh'),
            export: () => handleAction('export'),
          }}
        >
          <Renderer tree={flatTree} registry={componentRegistry} />
        </ActionProviderWithActions>
      </VisibilityProvider>
    </DataProvider>
  )
}
