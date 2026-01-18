'use client'

import { LayoutDashboard } from 'lucide-react'
import type { NestedUIElement } from '../lib/types'
import JsonRenderView from './JsonRenderView'

interface ArtifactPanelProps {
  ui: NestedUIElement | null
  onResizePointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void
  isResizing?: boolean
  artifactCount?: number
  artifactIndex?: number
  onArtifactIndexChange?: (nextIndex: number) => void
}

export function ArtifactPanel({
  ui,
  onResizePointerDown,
  isResizing,
  artifactCount,
  artifactIndex,
  onArtifactIndexChange,
}: ArtifactPanelProps) {
  const canNavigate =
    typeof artifactCount === 'number' &&
    typeof artifactIndex === 'number' &&
    typeof onArtifactIndexChange === 'function' &&
    artifactCount > 1 &&
    artifactIndex >= 0

  return (
    <div
      className={`relative flex h-full flex-col rounded-2xl border bg-white shadow-sm ${
        isResizing ? 'border-gray-300' : 'border-gray-200'
      }`}
    >
      {onResizePointerDown && (
        <div
          className="absolute inset-y-0 left-0 w-3 cursor-col-resize touch-none select-none"
          onPointerDown={onResizePointerDown}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panels"
        />
      )}
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-6 py-4">
        <h2 className="text-base font-semibold text-gray-900">Artifact</h2>
        {canNavigate && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => onArtifactIndexChange(artifactIndex - 1)}
              disabled={artifactIndex <= 0}
              aria-label="Previous artifact"
            >
              <span aria-hidden className="text-sm">
                ←
              </span>
            </button>
            <span className="text-xs tabular-nums text-gray-500">
              {artifactIndex + 1} / {artifactCount}
            </span>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => onArtifactIndexChange(artifactIndex + 1)}
              disabled={artifactIndex >= artifactCount - 1}
              aria-label="Next artifact"
            >
              <span aria-hidden className="text-sm">
                →
              </span>
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
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
          <JsonRenderView ui={ui} />
        )}
      </div>
    </div>
  )
}
