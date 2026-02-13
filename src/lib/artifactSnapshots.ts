import type {
  ArtifactDataSnapshot,
  NestedUIElement,
  QueryResult,
  Report,
} from './types'

const MAX_CHART_ROWS = 400
const MAX_TABLE_ROWS = 150
const MAX_FALLBACK_ROWS = 200

interface SnapshotRequirement {
  columns: Set<string> | null
  rowLimit: number
}

interface SnapshotSource {
  ui?: NestedUIElement
  report?: Report
  queryResults: QueryResult[]
}

function toResultKey(dataPath: string | undefined): string | null {
  if (!dataPath) return null
  const key = dataPath.replace(/^\//, '').split('/')[0]?.trim()
  return key || null
}

function mergeColumns(
  current: Set<string> | null,
  incoming: Set<string> | null
): Set<string> | null {
  if (current === null || incoming === null) return null
  return new Set([...current, ...incoming])
}

function registerRequirement(
  requirements: Map<string, SnapshotRequirement>,
  resultKey: string | null,
  columns: string[] | null,
  rowLimit: number
): void {
  if (!resultKey) return

  const incomingColumns =
    columns && columns.length > 0 ? new Set(columns.filter(Boolean)) : null
  const existing = requirements.get(resultKey)

  if (!existing) {
    requirements.set(resultKey, {
      columns: incomingColumns,
      rowLimit,
    })
    return
  }

  requirements.set(resultKey, {
    columns: mergeColumns(existing.columns, incomingColumns),
    rowLimit: Math.max(existing.rowLimit, rowLimit),
  })
}

function collectUiRequirements(
  element: NestedUIElement | undefined,
  requirements: Map<string, SnapshotRequirement>
): void {
  if (!element) return

  const dataPath = typeof element.props?.dataPath === 'string' ? element.props.dataPath : undefined
  const resultKey = toResultKey(dataPath)

  if (resultKey) {
    if (element.type === 'BarChart' || element.type === 'LineChart') {
      const xKey = typeof element.props?.xKey === 'string' ? element.props.xKey : null
      const yKey = typeof element.props?.yKey === 'string' ? element.props.yKey : null
      registerRequirement(
        requirements,
        resultKey,
        [xKey ?? '', yKey ?? ''],
        MAX_CHART_ROWS
      )
    } else if (element.type === 'PieChart') {
      const nameKey = typeof element.props?.nameKey === 'string' ? element.props.nameKey : null
      const valueKey = typeof element.props?.valueKey === 'string' ? element.props.valueKey : null
      registerRequirement(
        requirements,
        resultKey,
        [nameKey ?? '', valueKey ?? ''],
        MAX_CHART_ROWS
      )
    } else if (element.type === 'Table') {
      const columns = Array.isArray(element.props?.columns)
        ? (element.props!.columns as string[])
        : null
      registerRequirement(requirements, resultKey, columns, MAX_TABLE_ROWS)
    } else {
      registerRequirement(requirements, resultKey, null, MAX_FALLBACK_ROWS)
    }
  }

  if (!Array.isArray(element.children)) return
  for (const child of element.children) {
    collectUiRequirements(child, requirements)
  }
}

function collectReportRequirements(
  report: Report | undefined,
  requirements: Map<string, SnapshotRequirement>
): void {
  if (!report) return

  for (const section of report.sections) {
    const resultKey = toResultKey(section.dataPath)
    if (!resultKey) continue

    if (section.type === 'chart') {
      if (section.chartType === 'bar' || section.chartType === 'line') {
        registerRequirement(
          requirements,
          resultKey,
          [section.xKey ?? '', section.yKey ?? ''],
          MAX_CHART_ROWS
        )
      } else if (section.chartType === 'pie') {
        registerRequirement(
          requirements,
          resultKey,
          [section.nameKey ?? '', section.valueKey ?? ''],
          MAX_CHART_ROWS
        )
      } else {
        registerRequirement(requirements, resultKey, null, MAX_FALLBACK_ROWS)
      }
      continue
    }

    if (section.type === 'table') {
      registerRequirement(
        requirements,
        resultKey,
        section.columns ?? null,
        MAX_TABLE_ROWS
      )
      continue
    }

    registerRequirement(requirements, resultKey, null, MAX_FALLBACK_ROWS)
  }
}

function findValueCaseInsensitive(
  row: Record<string, unknown>,
  key: string
): unknown {
  if (key in row) return row[key]

  const normalizedKey = key.toLowerCase()
  const actualKey = Object.keys(row).find((candidate) => candidate.toLowerCase() === normalizedKey)
  return actualKey ? row[actualKey] : undefined
}

function projectRow(
  row: Record<string, unknown>,
  columns: Set<string> | null
): Record<string, unknown> {
  if (!columns || columns.size === 0) return row

  const projected: Record<string, unknown> = {}
  for (const column of columns) {
    const value = findValueCaseInsensitive(row, column)
    if (value === undefined) continue

    projected[column] = value

    const lowerColumn = column.toLowerCase()
    if (lowerColumn !== column && !(lowerColumn in projected)) {
      projected[lowerColumn] = value
    }
  }
  return projected
}

export function buildArtifactDataSnapshot(source: SnapshotSource): ArtifactDataSnapshot {
  const requirements = new Map<string, SnapshotRequirement>()

  collectUiRequirements(source.ui, requirements)
  collectReportRequirements(source.report, requirements)

  if (requirements.size === 0) return {}

  const snapshot: ArtifactDataSnapshot = {}

  for (const result of source.queryResults) {
    const requirement = requirements.get(result.resultKey)
    if (!requirement) continue

    const rows = Array.isArray(result.data) ? result.data : []
    if (rows.length === 0) continue

    snapshot[result.resultKey] = rows
      .slice(0, requirement.rowLimit)
      .map((row) => projectRow(row, requirement.columns))
  }

  return snapshot
}

export function mergeQueryResultsWithSnapshot(
  queryResults: QueryResult[],
  snapshot: ArtifactDataSnapshot | undefined
): QueryResult[] {
  if (!snapshot) return queryResults

  const merged = new Map<string, QueryResult>()
  for (const result of queryResults) {
    merged.set(result.resultKey, result)
  }

  for (const [resultKey, rows] of Object.entries(snapshot)) {
    const existing = merged.get(resultKey)
    if (existing && Array.isArray(existing.data) && existing.data.length > 0) {
      continue
    }

    merged.set(resultKey, {
      resultKey,
      data: rows,
      query: existing?.query,
      partial: true,
    })
  }

  return Array.from(merged.values())
}

export function snapshotHasRows(
  snapshot: ArtifactDataSnapshot | undefined,
  resultKey: string
): boolean {
  if (!snapshot) return false
  const rows = snapshot[resultKey]
  return Array.isArray(rows) && rows.length > 0
}
