import { createServerFn } from '@tanstack/react-start'
import { db, datasets, type ColumnInfo, type Dataset } from '../db'
import { eq, sql as drizzleSql } from 'drizzle-orm'
import { neon } from '@neondatabase/serverless'
import * as Papa from 'papaparse'

function getSql() {
  return neon(process.env.DATABASE_URL!)
}

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin'

function requireAuth(password: string) {
  if (password !== ADMIN_PASSWORD) {
    throw new Error('Unauthorized')
  }
}

function sanitizeTableName(name: string): string {
  return 'dataset_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 50)
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

    const columns: ColumnInfo[] = headers.map((header) => {
      const values = parsed.data.map((row) => row[header])
      const inferredType = inferColumnType(values)
      return {
        name: header,
        type: inferredType,
        originalType: inferredType,
      }
    })

    return {
      columns,
      sampleRows: rows,
      totalRows: parsed.data.length,
      suggestedName: data.name.replace(/\.csv$/i, ''),
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

    const tableName = sanitizeTableName(data.name)
    const sql = getSql()

    const columnDefs = data.columns
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
    const colNames = data.columns.map((c) => `"${c.name.replace(/"/g, '""')}"`).join(', ')

    try {
      for (let i = 0; i < parsed.data.length; i += batchSize) {
        const batch = parsed.data.slice(i, i + batchSize)
        const allValues: unknown[] = []
        const valuePlaceholders: string[] = []

        for (let j = 0; j < batch.length; j++) {
          const row = batch[j]
          const rowNumber = i + j + 2
          const rowPlaceholders: string[] = []

          for (let k = 0; k < data.columns.length; k++) {
            const col = data.columns[k]
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
          name: data.name,
          description: data.description,
          tableName,
          columns: data.columns,
          rowCount: String(parsed.data.length),
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

    const tableName = sanitizeTableName(data.name)

    const columnDefs = data.columns
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

    return { tableName }
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

    const sql = getSql()
    const colNames = data.columns.map((c) => `"${c.name.replace(/"/g, '""')}"`).join(', ')

    const allValues: unknown[] = []
    const valuePlaceholders: string[] = []

    for (let j = 0; j < data.rows.length; j++) {
      const row = data.rows[j]
      const rowPlaceholders: string[] = []

      for (let k = 0; k < data.columns.length; k++) {
        const col = data.columns[k]
        const paramIndex = allValues.length + 1
        rowPlaceholders.push(`$${paramIndex}`)
        allValues.push(convertValue(row[col.name], col.type))
      }
      valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`)
    }

    const insertQuery = `INSERT INTO "${data.tableName}" (${colNames}) VALUES ${valuePlaceholders.join(', ')}`
    await sql.query(insertQuery, allValues)

    return { inserted: data.rows.length }
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

    const [dataset] = await db
      .insert(datasets)
      .values({
        name: data.name,
        description: data.description,
        tableName: data.tableName,
        columns: data.columns,
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
