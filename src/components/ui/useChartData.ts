import { resolveRenderableRowsForDataPath } from '../../lib/renderability'

export interface ChartDataResult<T = unknown[]> {
  data: T
  isEmpty: boolean
  error: string | null
}

export interface ResolveDataPathOptions {
  requiredKeys?: string[]
  requireAllKeys?: boolean
  requireKeyCoverage?: 'all' | 'any'
}

export function resolveDataPath(
  data: Record<string, unknown>,
  dataPath: string,
  componentName: string,
  options: ResolveDataPathOptions = {}
): ChartDataResult {
  const { rows, error } = resolveRenderableRowsForDataPath(data, dataPath, {
    requiredKeys: options.requiredKeys,
    requireAllKeys: options.requireAllKeys,
    requireKeyCoverage: options.requireKeyCoverage,
  })

  if (rows.length === 0 && error) {
    console.warn(`[${componentName}] ${error}`)
  }

  return { data: rows, isEmpty: rows.length === 0, error }
}
