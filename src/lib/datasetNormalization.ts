import type { ColumnInfo } from '../db/schema'

const POSTGRES_IDENTIFIER_MAX_LENGTH = 63
const DATASET_NAME_MAX_LENGTH = 80
const NON_ALNUM_PATTERN = /[^a-z0-9]+/g
const DUPLICATE_UNDERSCORES_PATTERN = /_+/g
const LEADING_TRAILING_UNDERSCORES_PATTERN = /^_+|_+$/g

function trimUnderscores(value: string): string {
  return value.replace(LEADING_TRAILING_UNDERSCORES_PATTERN, '')
}

function toBaseIdentifier(value: string): string {
  return trimUnderscores(
    value
      .trim()
      .toLowerCase()
      .replace(NON_ALNUM_PATTERN, '_')
      .replace(DUPLICATE_UNDERSCORES_PATTERN, '_')
  )
}

function truncateIdentifier(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return trimUnderscores(value.slice(0, maxLength))
}

export function normalizeLookupKey(value: string): string {
  return toBaseIdentifier(value)
}

export function normalizeDatasetName(name: string): string {
  const normalized = toBaseIdentifier(name)
  if (!normalized) return 'dataset'
  const truncated = truncateIdentifier(normalized, DATASET_NAME_MAX_LENGTH)
  return truncated || 'dataset'
}

export function sanitizeTableName(name: string): string {
  const normalizedDatasetName = normalizeDatasetName(name)
  const prefixed = `dataset_${normalizedDatasetName}`
  const truncated = truncateIdentifier(prefixed, POSTGRES_IDENTIFIER_MAX_LENGTH)
  return truncated || 'dataset_default'
}

export function normalizeColumnName(name: string, index: number): string {
  const normalized = toBaseIdentifier(name)
  if (!normalized) {
    return `column_${index + 1}`
  }
  const truncated = truncateIdentifier(normalized, POSTGRES_IDENTIFIER_MAX_LENGTH)
  return truncated || `column_${index + 1}`
}

export function makeUniqueIdentifier(
  base: string,
  used: Set<string>,
  maxLength: number = POSTGRES_IDENTIFIER_MAX_LENGTH
): string {
  let candidate = truncateIdentifier(base, maxLength)
  if (!candidate) candidate = 'item'

  if (!used.has(candidate)) {
    used.add(candidate)
    return candidate
  }

  let counter = 2
  while (true) {
    const suffix = `_${counter}`
    const prefixMaxLength = Math.max(1, maxLength - suffix.length)
    const prefix = truncateIdentifier(base, prefixMaxLength) || 'item'
    candidate = `${prefix}${suffix}`
    if (!used.has(candidate)) {
      used.add(candidate)
      return candidate
    }
    counter += 1
  }
}

export function normalizeColumns(columns: ColumnInfo[]): ColumnInfo[] {
  const used = new Set<string>()

  return columns.map((column, index) => {
    const base = normalizeColumnName(column.name, index)
    const uniqueName = makeUniqueIdentifier(base, used, POSTGRES_IDENTIFIER_MAX_LENGTH)

    return {
      ...column,
      name: uniqueName,
    }
  })
}
