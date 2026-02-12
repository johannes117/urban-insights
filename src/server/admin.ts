import { createServerFn } from '@tanstack/react-start'
import { db, datasets, type ColumnInfo, type Dataset } from '../db'
import { eq, sql as drizzleSql } from 'drizzle-orm'
import { neon } from '@neondatabase/serverless'
import * as Papa from 'papaparse'
import {
  normalizeColumns,
  normalizeDatasetName,
  normalizeLookupKey,
  sanitizeTableName,
} from '../lib/datasetNormalization'

function getSql() {
  return neon(process.env.DATABASE_URL!)
}

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin'

function requireAuth(password: string) {
  if (password !== ADMIN_PASSWORD) {
    throw new Error('Unauthorized')
  }
}

function stripNumericFormatting(value: string): string {
  return value.replace(/[\s,]/g, '')
}

function inferColumnType(values: string[]): ColumnInfo['type'] {
  const nonEmpty = values.filter((v) => v !== '' && v !== null && v !== undefined)
  if (nonEmpty.length === 0) return 'text'

  const allNumeric = nonEmpty.every((v) => {
    const cleaned = stripNumericFormatting(v)
    return cleaned !== '' && !isNaN(Number(cleaned))
  })
  if (allNumeric) return 'numeric'

  const allBoolean = nonEmpty.every((v) =>
    ['true', 'false', '1', '0', 'yes', 'no'].includes(v.toLowerCase())
  )
  if (allBoolean) return 'boolean'

  const datePattern = /^\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}/
  const allDates = nonEmpty.every((v) => datePattern.test(v))
  if (allDates) return 'date'

  return 'text'
}

function getPgType(type: ColumnInfo['type']): string {
  switch (type) {
    case 'numeric':
      return 'DOUBLE PRECISION'
    case 'boolean':
      return 'BOOLEAN'
    case 'date':
      return 'DATE'
    default:
      return 'TEXT'
  }
}

function convertValue(value: string, type: ColumnInfo['type']): unknown {
  if (value === '' || value === null || value === undefined) return null

  switch (type) {
    case 'numeric':
      return Number(stripNumericFormatting(value))
    case 'boolean':
      return ['true', '1', 'yes'].includes(value.toLowerCase())
    case 'date':
      return value
    default:
      return value
  }
}

function resolveRowValue(
  row: Record<string, string>,
  normalizedColumnName: string,
  sourceColumnName?: string
): string {
  if (sourceColumnName && sourceColumnName in row) {
    return row[sourceColumnName] ?? ''
  }

  if (normalizedColumnName in row) {
    return row[normalizedColumnName] ?? ''
  }

  const targetKey = normalizeLookupKey(normalizedColumnName)
  const matchedKey = Object.keys(row).find((key) => normalizeLookupKey(key) === targetKey)
  if (!matchedKey) return ''

  return row[matchedKey] ?? ''
}

function remapRowsToNormalizedColumns(
  rows: Record<string, string>[],
  sourceColumns: ColumnInfo[],
  normalizedColumns: ColumnInfo[]
): Record<string, string>[] {
  return rows.map((row) => {
    const nextRow: Record<string, string> = {}

    for (let index = 0; index < normalizedColumns.length; index += 1) {
      const sourceColumn = sourceColumns[index]
      const normalizedColumn = normalizedColumns[index]
      if (!sourceColumn || !normalizedColumn) continue

      nextRow[normalizedColumn.name] = resolveRowValue(
        row,
        normalizedColumn.name,
        sourceColumn.name
      )
    }

    return nextRow
  })
}

export const verifyAdminPassword = createServerFn({ method: 'POST' })
  .inputValidator((d: { password: string }) => d)
  .handler(async ({ data }) => {
    return { valid: data.password === ADMIN_PASSWORD }
  })

export const listDatasets = createServerFn({ method: 'POST' })
  .inputValidator((d: { password: string }) => d)
  .handler(async ({ data }) => {
    requireAuth(data.password)
    const result = await db.select().from(datasets).orderBy(datasets.createdAt)
    return result
  })

export const toggleDataset = createServerFn({ method: 'POST' })
  .inputValidator((d: { password: string; id: string; enabled: boolean }) => d)
  .handler(async ({ data }) => {
    requireAuth(data.password)
    await db.update(datasets).set({ enabled: data.enabled }).where(eq(datasets.id, data.id))
    return { success: true }
  })

export const deleteDataset = createServerFn({ method: 'POST' })
  .inputValidator((d: { password: string; id: string }) => d)
  .handler(async ({ data }) => {
    requireAuth(data.password)

    const [dataset] = await db.select().from(datasets).where(eq(datasets.id, data.id))
    if (!dataset) throw new Error('Dataset not found')

    await db.execute(drizzleSql.raw(`DROP TABLE IF EXISTS "${dataset.tableName}"`))
    await db.delete(datasets).where(eq(datasets.id, data.id))

    return { success: true }
  })

export const previewCsv = createServerFn({ method: 'POST' })
  .inputValidator((d: { password: string; csvContent: string; name: string }) => d)
  .handler(async ({ data }) => {
    requireAuth(data.password)

    const parsed = Papa.parse<Record<string, string>>(data.csvContent, {
      header: true,
      skipEmptyLines: true,
    })

    if (parsed.errors.length > 0) {
      throw new Error(`CSV parsing error: ${parsed.errors[0].message}`)
    }

    const headers = parsed.meta.fields || []
    const rows = parsed.data.slice(0, 10)

    const sourceColumns: ColumnInfo[] = headers.map((header) => {
      const values = parsed.data.map((row) => row[header])
      const inferredType = inferColumnType(values)
      return {
        name: header,
        type: inferredType,
        originalType: inferredType,
      }
    })

    const columns = normalizeColumns(sourceColumns)
    const sampleRows = remapRowsToNormalizedColumns(rows, sourceColumns, columns)
    const suggestedName = normalizeDatasetName(data.name.replace(/\.csv$/i, ''))

    return {
      columns,
      sampleRows,
      totalRows: parsed.data.length,
      suggestedName,
    }
  })

export const uploadDataset = createServerFn({ method: 'POST' })
  .inputValidator(
    (d: {
      password: string
      csvContent: string
      name: string
      description: string
      columns: ColumnInfo[]
    }) => d
  )
  .handler(async ({ data }) => {
    requireAuth(data.password)

    let parsed: Papa.ParseResult<Record<string, string>>
    try {
      parsed = Papa.parse<Record<string, string>>(data.csvContent, {
        header: true,
        skipEmptyLines: true,
      })
    } catch (e) {
      throw new Error(`Failed to parse CSV: ${e instanceof Error ? e.message : 'Unknown parsing error'}`)
    }

    if (parsed.errors.length > 0) {
      const errorDetails = parsed.errors.slice(0, 3).map((e) => `Row ${e.row}: ${e.message}`).join('; ')
      throw new Error(`CSV parsing errors: ${errorDetails}`)
    }

    if (parsed.data.length === 0) {
      throw new Error('CSV file is empty or contains no valid data rows')
    }

    const normalizedName = normalizeDatasetName(data.name)
    const sourceColumns = data.columns
    const normalizedColumns = normalizeColumns(sourceColumns)
    const normalizedRows = remapRowsToNormalizedColumns(parsed.data, sourceColumns, normalizedColumns)

    const tableName = sanitizeTableName(normalizedName)
    const sql = getSql()

    const columnDefs = normalizedColumns
      .map((col) => `"${col.name.replace(/"/g, '""')}" ${getPgType(col.type)}`)
      .join(', ')

    try {
      await db.execute(drizzleSql.raw(`DROP TABLE IF EXISTS "${tableName}"`))
    } catch (e) {
      throw new Error(`Failed to prepare database: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }

    try {
      await db.execute(drizzleSql.raw(`CREATE TABLE "${tableName}" (id SERIAL PRIMARY KEY, ${columnDefs})`))
    } catch (e) {
      throw new Error(`Failed to create table: ${e instanceof Error ? e.message : 'Unknown error'}. Check column names for invalid characters.`)
    }

    const batchSize = 200
    const colNames = normalizedColumns.map((c) => `"${c.name.replace(/"/g, '""')}"`).join(', ')

    try {
      for (let i = 0; i < normalizedRows.length; i += batchSize) {
        const batch = normalizedRows.slice(i, i + batchSize)
        const allValues: unknown[] = []
        const valuePlaceholders: string[] = []

        for (let j = 0; j < batch.length; j++) {
          const row = batch[j]
          const rowNumber = i + j + 2
          const rowPlaceholders: string[] = []

          for (let k = 0; k < normalizedColumns.length; k++) {
            const col = normalizedColumns[k]
            const paramIndex = allValues.length + 1
            rowPlaceholders.push(`$${paramIndex}`)
            try {
              allValues.push(convertValue(row[col.name], col.type))
            } catch (e) {
              throw new Error(`Row ${rowNumber}, column "${col.name}": ${e instanceof Error ? e.message : 'conversion failed'}`)
            }
          }
          valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`)
        }

        const insertQuery = `INSERT INTO "${tableName}" (${colNames}) VALUES ${valuePlaceholders.join(', ')}`
        await sql.query(insertQuery, allValues)
      }
    } catch (e) {
      await db.execute(drizzleSql.raw(`DROP TABLE IF EXISTS "${tableName}"`))
      throw e
    }

    try {
      const [dataset] = await db
        .insert(datasets)
        .values({
          name: normalizedName,
          description: data.description,
          tableName,
          columns: normalizedColumns,
          rowCount: String(normalizedRows.length),
        })
        .returning()

      return dataset
    } catch (e) {
      await db.execute(drizzleSql.raw(`DROP TABLE IF EXISTS "${tableName}"`))
      throw new Error(`Failed to save dataset metadata: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  })

export const createDatasetTable = createServerFn({ method: 'POST' })
  .inputValidator(
    (d: {
      password: string
      name: string
      columns: ColumnInfo[]
    }) => d
  )
  .handler(async ({ data }) => {
    requireAuth(data.password)

    const normalizedName = normalizeDatasetName(data.name)
    const normalizedColumns = normalizeColumns(data.columns)
    const tableName = sanitizeTableName(normalizedName)

    const columnDefs = normalizedColumns
      .map((col) => `"${col.name.replace(/"/g, '""')}" ${getPgType(col.type)}`)
      .join(', ')

    try {
      await db.execute(drizzleSql.raw(`DROP TABLE IF EXISTS "${tableName}"`))
    } catch (e) {
      throw new Error(`Failed to prepare database: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }

    try {
      await db.execute(drizzleSql.raw(`CREATE TABLE "${tableName}" (id SERIAL PRIMARY KEY, ${columnDefs})`))
    } catch (e) {
      throw new Error(`Failed to create table: ${e instanceof Error ? e.message : 'Unknown error'}. Check column names for invalid characters.`)
    }

    return {
      tableName,
      datasetName: normalizedName,
      columns: normalizedColumns,
    }
  })

export const insertDatasetBatch = createServerFn({ method: 'POST' })
  .inputValidator(
    (d: {
      password: string
      tableName: string
      columns: ColumnInfo[]
      rows: Record<string, string>[]
    }) => d
  )
  .handler(async ({ data }) => {
    requireAuth(data.password)

    if (data.rows.length === 0) return { inserted: 0 }

    const sourceColumns = data.columns
    const normalizedColumns = normalizeColumns(sourceColumns)
    const normalizedRows = remapRowsToNormalizedColumns(data.rows, sourceColumns, normalizedColumns)

    const sql = getSql()
    const colNames = normalizedColumns.map((c) => `"${c.name.replace(/"/g, '""')}"`).join(', ')

    const allValues: unknown[] = []
    const valuePlaceholders: string[] = []

    for (let j = 0; j < normalizedRows.length; j++) {
      const row = normalizedRows[j]
      const rowPlaceholders: string[] = []

      for (let k = 0; k < normalizedColumns.length; k++) {
        const col = normalizedColumns[k]
        const paramIndex = allValues.length + 1
        rowPlaceholders.push(`$${paramIndex}`)
        allValues.push(convertValue(row[col.name], col.type))
      }
      valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`)
    }

    const insertQuery = `INSERT INTO "${data.tableName}" (${colNames}) VALUES ${valuePlaceholders.join(', ')}`
    await sql.query(insertQuery, allValues)

    return { inserted: normalizedRows.length }
  })

export const finalizeDataset = createServerFn({ method: 'POST' })
  .inputValidator(
    (d: {
      password: string
      name: string
      description: string
      tableName: string
      columns: ColumnInfo[]
      rowCount: number
    }) => d
  )
  .handler(async ({ data }) => {
    requireAuth(data.password)

    const normalizedName = normalizeDatasetName(data.name)
    const normalizedColumns = normalizeColumns(data.columns)

    const [dataset] = await db
      .insert(datasets)
      .values({
        name: normalizedName,
        description: data.description,
        tableName: data.tableName,
        columns: normalizedColumns,
        rowCount: String(data.rowCount),
      })
      .returning()

    return dataset
  })

export const deleteDatasetTable = createServerFn({ method: 'POST' })
  .inputValidator((d: { password: string; tableName: string }) => d)
  .handler(async ({ data }) => {
    requireAuth(data.password)
    await db.execute(drizzleSql.raw(`DROP TABLE IF EXISTS "${data.tableName}"`))
    return { success: true }
  })

export const getDatasetPreview = createServerFn({ method: 'POST' })
  .inputValidator((d: { password: string; id: string }) => d)
  .handler(async ({ data }) => {
    requireAuth(data.password)

    const [dataset] = await db.select().from(datasets).where(eq(datasets.id, data.id))
    if (!dataset) throw new Error('Dataset not found')

    const sql = getSql()
    const rows = await sql.query(`SELECT * FROM "${dataset.tableName}" LIMIT 10`, [])

    return {
      dataset,
      rows,
    }
  })

export type { Dataset }
