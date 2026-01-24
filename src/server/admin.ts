import { createServerFn } from '@tanstack/react-start'
import { db, datasets, type ColumnInfo, type Dataset } from '../db'
import { eq, sql as drizzleSql } from 'drizzle-orm'
import { neon } from '@neondatabase/serverless'
import Papa from 'papaparse'

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

function inferColumnType(values: string[]): ColumnInfo['type'] {
  const nonEmpty = values.filter((v) => v !== '' && v !== null && v !== undefined)
  if (nonEmpty.length === 0) return 'text'

  const allNumeric = nonEmpty.every((v) => !isNaN(Number(v)) && v.trim() !== '')
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
      return Number(value)
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
    console.log('[Admin] Deleting dataset:', data.id)

    const [dataset] = await db.select().from(datasets).where(eq(datasets.id, data.id))
    if (!dataset) throw new Error('Dataset not found')

    console.log('[Admin] Dropping table:', dataset.tableName)
    await db.execute(drizzleSql.raw(`DROP TABLE IF EXISTS "${dataset.tableName}"`))
    await db.delete(datasets).where(eq(datasets.id, data.id))

    console.log('[Admin] Dataset deleted successfully')
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
    console.log('[Admin] Starting upload for:', data.name)

    const parsed = Papa.parse<Record<string, string>>(data.csvContent, {
      header: true,
      skipEmptyLines: true,
    })

    if (parsed.errors.length > 0) {
      console.error('[Admin] CSV parse error:', parsed.errors[0])
      throw new Error(`CSV parsing error: ${parsed.errors[0].message}`)
    }

    const tableName = sanitizeTableName(data.name)
    console.log('[Admin] Table name:', tableName, 'Rows:', parsed.data.length)

    const sql = getSql()

    const columnDefs = data.columns
      .map((col) => `"${col.name.replace(/"/g, '""')}" ${getPgType(col.type)}`)
      .join(', ')

    console.log('[Admin] Creating table with columns:', columnDefs)
    await db.execute(drizzleSql.raw(`DROP TABLE IF EXISTS "${tableName}"`))
    await db.execute(drizzleSql.raw(`CREATE TABLE "${tableName}" (id SERIAL PRIMARY KEY, ${columnDefs})`))

    console.log('[Admin] Inserting', parsed.data.length, 'rows...')
    const batchSize = 100
    for (let i = 0; i < parsed.data.length; i += batchSize) {
      const batch = parsed.data.slice(i, i + batchSize)

      for (const row of batch) {
        const colNames = data.columns.map((c) => `"${c.name.replace(/"/g, '""')}"`).join(', ')
        const placeholders = data.columns.map((_, idx) => `$${idx + 1}`).join(', ')
        const values = data.columns.map((col) => convertValue(row[col.name], col.type))

        const insertQuery = `INSERT INTO "${tableName}" (${colNames}) VALUES (${placeholders})`
        await sql.query(insertQuery, values)
      }
    }

    console.log('[Admin] Saving dataset metadata...')
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

    console.log('[Admin] Upload complete:', dataset.id)
    return dataset
  })

export const getDatasetPreview = createServerFn({ method: 'POST' })
  .inputValidator((d: { password: string; id: string }) => d)
  .handler(async ({ data }) => {
    requireAuth(data.password)
    console.log('[Admin] Getting preview for dataset:', data.id)

    const [dataset] = await db.select().from(datasets).where(eq(datasets.id, data.id))
    if (!dataset) throw new Error('Dataset not found')

    const sql = getSql()
    const rows = await sql.query(`SELECT * FROM "${dataset.tableName}" LIMIT 10`, [])

    console.log('[Admin] Preview rows:', rows.rows?.length || 0)
    return {
      dataset,
      rows: rows.rows || [],
    }
  })

export type { Dataset }
