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

function extractDataPathsFromUI(element: NestedUIElement): string[] {
  const paths: string[] = []
  if (element.props?.dataPath) {
    paths.push(element.props.dataPath as string)
  }
  if (element.children) {
    for (const child of element.children) {
      paths.push(...extractDataPathsFromUI(child))
    }
  }
  return paths
}

export default function JsonRenderView({ ui, queryResults = [] }: JsonRenderViewProps) {
  const flatTree = nestedToFlat(ui)

  const data = useMemo(() => {
    const merged: Record<string, unknown> = {}
    for (const result of queryResults) {
      merged[result.resultKey] = result.data
    }

    const requiredPaths = extractDataPathsFromUI(ui)
    const availableKeys = Object.keys(merged)

    for (const path of requiredPaths) {
      const key = path.replace(/^\//, '').split('/')[0]
      if (!availableKeys.includes(key)) {
        console.warn(
          `[JsonRenderView] UI requires dataPath "${path}" but key "${key}" not found in query results. Available keys:`,
          availableKeys
        )
      }
    }

    if (requiredPaths.length > 0 && availableKeys.length === 0) {
      console.warn('[JsonRenderView] UI has data paths but no query results were provided')
    }

    return merged
  }, [queryResults, ui])

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
    <DataProvider initialData={data}>
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
