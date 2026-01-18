'use client'

import { Suspense, lazy } from 'react'
import { LayoutDashboard } from 'lucide-react'
import type { NestedUIElement } from '../lib/types'

const JsonRenderView = lazy(() => import('./JsonRenderView'))

interface ArtifactPanelProps {
  ui: NestedUIElement | null
}

export function ArtifactPanel({ ui }: ArtifactPanelProps) {
  console.log('ArtifactPanel received ui:', ui)
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-lg font-semibold text-gray-900">Artifact</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!ui ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <LayoutDashboard className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-2 text-gray-500">No visualization yet</p>
              <p className="mt-1 text-sm text-gray-400">
                Ask the assistant to create charts or dashboards
              </p>
            </div>
          </div>
        ) : (
          <Suspense fallback={<div className="text-gray-400">Loading...</div>}>
            <JsonRenderView ui={ui} />
          </Suspense>
        )}
      </div>
    </div>
  )
}
