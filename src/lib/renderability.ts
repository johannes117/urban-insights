import type { NestedUIElement, QueryResult, Report, ReportSection } from './types'
import { normalizeLookupKey } from './datasetNormalization'

type DataRecord = Record<string, unknown>
type DataRow = Record<string, unknown>

export interface DataRequirement {
  requiredKeys?: string[]
  requireAllKeys?: boolean
  requireKeyCoverage?: 'all' | 'any'
}

export interface ResolvedRows {
  rows: DataRow[]
  error: string | null
}

export interface RenderabilityIssue {
  target: 'ui' | 'report'
  componentType: string
  message: string
  dataPath?: string
  requiredKeys?: string[]
  availableKeys?: string[]
}

interface UiDataRequirement extends DataRequirement {
  dataPath: string
}

const STRUCTURAL_UI_TYPES = new Set(['Card', 'Grid', 'div', 'span', 'section'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getStringProp(props: Record<string, unknown>, key: string): string | undefined {
  const value = props[key]
  return typeof value === 'string' ? value : undefined
}

function getStringArrayProp(props: Record<string, unknown>, key: string): string[] {
  const value = props[key]
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function hasRenderableValue(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number') return Number.isFinite(value)
  return true
}

function findValueCaseInsensitive(row: DataRow, key: string): unknown {
  if (key in row) return row[key]

  const normalized = key.toLowerCase()
  const actual = Object.keys(row).find((candidate) => candidate.toLowerCase() === normalized)
  if (actual) return row[actual]

  const normalizedLookup = normalizeLookupKey(key)
  if (!normalizedLookup) return undefined

  const fuzzyMatch = Object.keys(row).find(
    (candidate) => normalizeLookupKey(candidate) === normalizedLookup
  )
  return fuzzyMatch ? row[fuzzyMatch] : undefined
}

function normalizeRowWithRequiredKeys(row: DataRow, requiredKeys: string[]): DataRow {
  if (requiredKeys.length === 0) return row

  let normalized: DataRow | null = null
  for (const key of requiredKeys) {
    const trimmed = key.trim()
    if (!trimmed) continue

    if (trimmed in row) continue
    const value = findValueCaseInsensitive(row, trimmed)
    if (value === undefined) continue

    normalized ??= { ...row }
    normalized[trimmed] = value
  }

  return normalized ?? row
}

function rowMatchesRequirement(
  row: DataRow,
  requiredKeys: string[],
  requireAllKeys: boolean
): boolean {
  if (requiredKeys.length === 0) return true

  const match = (key: string) => hasRenderableValue(row[key])
  return requireAllKeys ? requiredKeys.every(match) : requiredKeys.some(match)
}

function getUiDataRequirement(element: NestedUIElement): UiDataRequirement | null {
  const props = isRecord(element.props) ? element.props : {}
  const dataPath = getStringProp(props, 'dataPath')
  if (!dataPath) return null

  if (element.type === 'BarChart' || element.type === 'LineChart') {
    const xKey = getStringProp(props, 'xKey')
    const yKey = getStringProp(props, 'yKey')
    if (!xKey || !yKey) return null
    return { dataPath, requiredKeys: [xKey, yKey], requireAllKeys: true }
  }

  if (element.type === 'PieChart') {
    const nameKey = getStringProp(props, 'nameKey')
    const valueKey = getStringProp(props, 'valueKey')
    if (!nameKey || !valueKey) return null
    return { dataPath, requiredKeys: [nameKey, valueKey], requireAllKeys: true }
  }

  if (element.type === 'Table') {
    const columns = getStringArrayProp(props, 'columns')
    if (columns.length === 0) return null
    return {
      dataPath,
      requiredKeys: columns,
      requireAllKeys: false,
      requireKeyCoverage: 'all',
    }
  }

  if (element.type === 'List') {
    return { dataPath }
  }

  return null
}

function getReportSectionDataRequirement(section: ReportSection): UiDataRequirement | null {
  if (!section.dataPath) return null

  if (section.type === 'chart' && section.chartType === 'bar') {
    if (!section.xKey || !section.yKey) return null
    return {
      dataPath: section.dataPath,
      requiredKeys: [section.xKey, section.yKey],
      requireAllKeys: true,
    }
  }

  if (section.type === 'chart' && section.chartType === 'line') {
    if (!section.xKey || !section.yKey) return null
    return {
      dataPath: section.dataPath,
      requiredKeys: [section.xKey, section.yKey],
      requireAllKeys: true,
    }
  }

  if (section.type === 'chart' && section.chartType === 'pie') {
    if (!section.nameKey || !section.valueKey) return null
    return {
      dataPath: section.dataPath,
      requiredKeys: [section.nameKey, section.valueKey],
      requireAllKeys: true,
    }
  }

  if (section.type === 'table') {
    const columns = section.columns?.filter((column) => column.trim().length > 0) ?? []
    if (columns.length === 0) return null
    return {
      dataPath: section.dataPath,
      requiredKeys: columns,
      requireAllKeys: false,
      requireKeyCoverage: 'all',
    }
  }

  return null
}

function withPrunedChildren(
  element: NestedUIElement,
  children: NestedUIElement[]
): NestedUIElement {
  return {
    ...element,
    children: children.length > 0 ? children : undefined,
  }
}

export function toResultKey(dataPath: string | undefined): string | null {
  if (!dataPath) return null
  const key = dataPath.replace(/^\//, '').split('/')[0]?.trim()
  return key || null
}

export function buildQueryResultData(queryResults: QueryResult[]): DataRecord {
  const data: DataRecord = {}
  for (const result of queryResults) {
    if (!Array.isArray(result.data)) continue
    data[result.resultKey] = result.data
  }
  return data
}

function getAvailableKeysAtDataPath(
  data: DataRecord,
  dataPath: string | undefined
): string[] {
  if (!dataPath) return []

  const pathParts = dataPath.replace(/^\//, '').split('/').filter((part) => part.length > 0)
  if (pathParts.length === 0) return []

  let current: unknown = data
  for (const part of pathParts) {
    if (!isRecord(current) || !(part in current)) {
      return []
    }
    current = current[part]
  }

  if (Array.isArray(current)) {
    const sampleRow = current.find((value): value is DataRow => isRecord(value))
    return sampleRow ? Object.keys(sampleRow) : []
  }

  if (isRecord(current)) {
    return Object.keys(current)
  }

  return []
}

export function resolveRenderableRowsForDataPath(
  data: DataRecord,
  dataPath: string | undefined,
  requirement: DataRequirement = {}
): ResolvedRows {
  if (!dataPath || dataPath.trim().length === 0) {
    return { rows: [], error: 'Missing data path' }
  }

  const pathParts = dataPath.replace(/^\//, '').split('/').filter((part) => part.length > 0)
  if (pathParts.length === 0) {
    return { rows: [], error: `Invalid data path "${dataPath}"` }
  }

  let current: unknown = data
  for (const part of pathParts) {
    if (!isRecord(current) || !(part in current)) {
      return { rows: [], error: `Data not found at path "${dataPath}"` }
    }
    current = current[part]
  }

  if (!Array.isArray(current)) {
    return { rows: [], error: `Data at "${dataPath}" is not an array` }
  }

  if (current.length === 0) {
    return { rows: [], error: null }
  }

  const rawRows = current.filter(isRecord)
  if (rawRows.length === 0) {
    return { rows: [], error: `Data at "${dataPath}" has no object rows` }
  }

  const requiredKeys =
    requirement.requiredKeys?.map((key) => key.trim()).filter((key) => key.length > 0) ?? []
  const requireAllKeys = requirement.requireAllKeys ?? true
  const requireKeyCoverage = requirement.requireKeyCoverage ?? 'any'
  const normalizedRows = rawRows.map((row) => normalizeRowWithRequiredKeys(row, requiredKeys))

  if (requiredKeys.length > 0 && requireKeyCoverage === 'all') {
    const hasCoverageForAllKeys = requiredKeys.every((key) =>
      normalizedRows.some((row) => key in row)
    )

    if (!hasCoverageForAllKeys) {
      return {
        rows: [],
        error: `Missing required fields (${requiredKeys.join(', ')})`,
      }
    }
  }

  const matchedRows = normalizedRows.filter((row) =>
    rowMatchesRequirement(row, requiredKeys, requireAllKeys)
  )

  if (matchedRows.length === 0) {
    return {
      rows: [],
      error:
        requiredKeys.length > 0
          ? `No rows matched required fields (${requiredKeys.join(', ')})`
          : null,
    }
  }

  return { rows: matchedRows, error: null }
}

export function pruneNonRenderableUi(
  element: NestedUIElement | null | undefined,
  data: DataRecord
): NestedUIElement | null {
  if (!element) return null

  const prunedChildren =
    element.children
      ?.map((child) => pruneNonRenderableUi(child, data))
      .filter((child): child is NestedUIElement => child !== null) ?? []

  const uiDataRequirement = getUiDataRequirement(element)
  if (uiDataRequirement) {
    const { rows } = resolveRenderableRowsForDataPath(
      data,
      uiDataRequirement.dataPath,
      uiDataRequirement
    )
    if (rows.length === 0) return null
    return withPrunedChildren(element, prunedChildren)
  }

  if (element.type === 'Text') {
    const props = isRecord(element.props) ? element.props : {}
    const content = getStringProp(props, 'content')?.trim()
    if (!content) return null
    return withPrunedChildren(element, prunedChildren)
  }

  if (element.type === 'Metric') {
    const props = isRecord(element.props) ? element.props : {}
    const label = getStringProp(props, 'label')?.trim()
    const value = getStringProp(props, 'value')?.trim()
    if (!label && !value) return null
    return withPrunedChildren(element, prunedChildren)
  }

  if (prunedChildren.length > 0) {
    return withPrunedChildren(element, prunedChildren)
  }

  if (STRUCTURAL_UI_TYPES.has(element.type)) {
    return null
  }

  return withPrunedChildren(element, prunedChildren)
}

export function isReportSectionRenderable(section: ReportSection, data: DataRecord): boolean {
  if (section.type === 'text') {
    return typeof section.content === 'string' && section.content.trim().length > 0
  }

  if (section.type === 'metric') {
    const hasContent = typeof section.content === 'string' && section.content.trim().length > 0
    const hasTitle = typeof section.title === 'string' && section.title.trim().length > 0
    return hasContent || hasTitle
  }

  const requirement = getReportSectionDataRequirement(section)
  if (!requirement) return false

  const { rows } = resolveRenderableRowsForDataPath(data, requirement.dataPath, requirement)
  return rows.length > 0
}

export function pruneNonRenderableReport(
  report: Report | null | undefined,
  data: DataRecord
): Report | null {
  if (!report) return null

  return {
    ...report,
    sections: report.sections.filter((section) => isReportSectionRenderable(section, data)),
  }
}

export function hasRenderableReport(report: Report | null | undefined, data: DataRecord): boolean {
  if (!report) return false
  if (report.sections.some((section) => isReportSectionRenderable(section, data))) return true

  return [report.introduction, report.callToAction, report.closing].some(
    (value) => typeof value === 'string' && value.trim().length > 0
  )
}

function collectUiIssues(
  element: NestedUIElement | null | undefined,
  data: DataRecord,
  issues: RenderabilityIssue[]
): void {
  if (!element) return

  const requirement = getUiDataRequirement(element)
  if (requirement) {
    const result = resolveRenderableRowsForDataPath(data, requirement.dataPath, requirement)
    if (result.rows.length === 0) {
      issues.push({
        target: 'ui',
        componentType: element.type,
        message: result.error ?? 'No rows available for render',
        dataPath: requirement.dataPath,
        requiredKeys: requirement.requiredKeys,
        availableKeys: getAvailableKeysAtDataPath(data, requirement.dataPath),
      })
    }
  }

  if (Array.isArray(element.children)) {
    for (const child of element.children) {
      collectUiIssues(child, data, issues)
    }
  }
}

function collectReportIssues(
  report: Report | null | undefined,
  data: DataRecord,
  issues: RenderabilityIssue[]
): void {
  if (!report) return

  for (const section of report.sections) {
    const requirement = getReportSectionDataRequirement(section)
    if (!requirement) continue

    const result = resolveRenderableRowsForDataPath(data, requirement.dataPath, requirement)
    if (result.rows.length === 0) {
      issues.push({
        target: 'report',
        componentType: section.type === 'chart' ? `chart:${section.chartType ?? 'unknown'}` : section.type,
        message: result.error ?? 'No rows available for render',
        dataPath: requirement.dataPath,
        requiredKeys: requirement.requiredKeys,
        availableKeys: getAvailableKeysAtDataPath(data, requirement.dataPath),
      })
    }
  }
}

interface ArtifactIssueInput {
  ui?: NestedUIElement | null
  report?: Report | null
  queryResults?: QueryResult[]
}

export function collectArtifactRenderabilityIssues({
  ui = null,
  report = null,
  queryResults = [],
}: ArtifactIssueInput): RenderabilityIssue[] {
  const data = buildQueryResultData(queryResults)
  const issues: RenderabilityIssue[] = []

  collectUiIssues(ui, data, issues)
  collectReportIssues(report, data, issues)

  return issues
}

interface SanitizeArtifactContentInput {
  ui?: NestedUIElement | null
  report?: Report | null
  queryResults?: QueryResult[]
}

export interface SanitizedArtifactContent {
  ui: NestedUIElement | null
  report: Report | null
  data: DataRecord
  hasRenderableContent: boolean
}

export function sanitizeArtifactContent({
  ui = null,
  report = null,
  queryResults = [],
}: SanitizeArtifactContentInput): SanitizedArtifactContent {
  const data = buildQueryResultData(queryResults)
  const sanitizedUi = pruneNonRenderableUi(ui, data)
  const sanitizedReport = pruneNonRenderableReport(report, data)
  const hasRenderableContent =
    Boolean(sanitizedUi) || hasRenderableReport(sanitizedReport, data)

  return {
    ui: sanitizedUi,
    report: sanitizedReport,
    data,
    hasRenderableContent,
  }
}
