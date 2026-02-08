import { tool } from '@langchain/core/tools'
import { z } from 'zod/v3'
import { db, datasets } from '../db'
import { eq } from 'drizzle-orm'
import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

function getSql(): NeonQueryFunction<false, false> {
  return neon(process.env.DATABASE_URL!)
}

export const listDatasetsTool = tool(
  async () => {
    const results = await db
      .select({
        id: datasets.id,
        name: datasets.name,
        description: datasets.description,
        tableName: datasets.tableName,
        columns: datasets.columns,
        rowCount: datasets.rowCount,
      })
      .from(datasets)
      .where(eq(datasets.enabled, true))

    if (results.length === 0) {
      return JSON.stringify({
        message: 'No datasets available. Ask the user to upload datasets via the admin panel.',
        datasets: [],
      })
    }

    return JSON.stringify({
      message: 'IMPORTANT: Use the "name" field (not tableName) when calling get_dataset_schema. You MUST call get_dataset_schema before running any queries.',
      datasets: results.map((d) => ({
        name: d.name,
        description: d.description,
        rowCount: d.rowCount,
        columns: d.columns.map((c) => ({ name: c.name, type: c.type })),
      })),
    })
  },
  {
    name: 'list_datasets',
    description:
      'List all available datasets. Returns dataset names, descriptions, column info, and row counts. After calling this, you MUST call get_dataset_schema for each dataset you want to query - never query a dataset without getting its schema first.',
    schema: z.object({}),
  }
)

function identifyLgaColumn(columns: { name: string; type: string }[]): string | null {
  const lgaPatterns = ['lga_name', 'lga', 'council', 'local_government', 'municipality']
  for (const col of columns) {
    const lower = col.name.toLowerCase()
    for (const pattern of lgaPatterns) {
      if (lower.includes(pattern)) {
        return col.name
      }
    }
  }
  return null
}

function generateExampleQuery(tableName: string, columns: { name: string; type: string }[], lgaColumn: string | null): string {
  const selectCols = columns.slice(0, 5).map(c => `"${c.name}"`).join(', ')
  let query = `SELECT ${selectCols} FROM "${tableName}" LIMIT 10`
  if (lgaColumn) {
    query = `SELECT ${selectCols} FROM "${tableName}" WHERE "${lgaColumn}" = 'Your LGA Name' LIMIT 10`
  }
  return query
}

export const getDatasetSchemaTool = tool(
  async ({ datasetName }) => {
    const [dataset] = await db
      .select()
      .from(datasets)
      .where(eq(datasets.name, datasetName))
      .limit(1)

    if (!dataset) {
      const allDatasets = await db.select({ name: datasets.name }).from(datasets).where(eq(datasets.enabled, true))
      return JSON.stringify({
        error: `Dataset "${datasetName}" not found. Use one of the exact names from list_datasets.`,
        availableDatasets: allDatasets.map((d) => d.name),
        hint: 'The datasetName parameter should be the "name" field from list_datasets, NOT the tableName.',
      })
    }

    if (!dataset.enabled) {
      return JSON.stringify({ error: `Dataset "${datasetName}" is currently disabled.` })
    }

    const sql = getSql()
    const sampleRows = await sql.query(`SELECT * FROM "${dataset.tableName}" LIMIT 5`, [])

    const columnNames = dataset.columns.map(c => c.name)
    const lgaColumn = identifyLgaColumn(dataset.columns)
    const exampleQuery = generateExampleQuery(dataset.tableName, dataset.columns, lgaColumn)

    return JSON.stringify({
      tableName: dataset.tableName,
      totalRows: dataset.rowCount,
      exactColumnNames: columnNames,
      lgaColumn: lgaColumn ? `Filter by LGA using column "${lgaColumn}"` : 'No LGA column detected',
      exampleQuery,
      columns: dataset.columns,
      sampleData: sampleRows,
      critical: `COPY THESE EXACT COLUMN NAMES: ${columnNames.map(n => `"${n}"`).join(', ')}`,
    })
  },
  {
    name: 'get_dataset_schema',
    description:
      'REQUIRED before any query_dataset call. Returns the exact tableName and column names you MUST use in queries. Copy column names exactly as shown.',
    schema: z.object({
      datasetName: z.string().describe('The dataset name from list_datasets (e.g., "sales_2024", not "dataset_sales_2024")'),
    }),
  }
)

export function validateSelectQuery(query: string): { valid: boolean; error?: string } {
  const normalized = query.trim().toLowerCase()

  if (!normalized.startsWith('select')) {
    return { valid: false, error: 'Only SELECT queries are allowed' }
  }

  const forbidden = ['drop', 'delete', 'insert', 'update', 'alter', 'create', 'truncate', 'grant', 'revoke']
  for (const keyword of forbidden) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i')
    if (regex.test(query)) {
      return { valid: false, error: `Forbidden keyword: ${keyword}` }
    }
  }

  return { valid: true }
}

interface TableInfo {
  columns: string[]
  originalColumns: string[]
}

async function getAvailableTables(): Promise<Map<string, TableInfo>> {
  const allDatasets = await db
    .select({ tableName: datasets.tableName, columns: datasets.columns })
    .from(datasets)
    .where(eq(datasets.enabled, true))

  const tableMap = new Map<string, TableInfo>()
  for (const d of allDatasets) {
    tableMap.set(d.tableName.toLowerCase(), {
      columns: d.columns.map((c) => c.name.toLowerCase()),
      originalColumns: d.columns.map((c) => c.name),
    })
  }
  return tableMap
}

function extractTableFromQuery(query: string): string | null {
  const match = query.match(/\bfrom\s+["']?(\w+)["']?/i)
  return match ? match[1] : null
}

export const queryDatasetTool = tool(
  async ({ query, resultKey }) => {
    const result = await executeDatasetQuery({ query, resultKey })
    return JSON.stringify(result)
  },
  {
    name: 'query_dataset',
    description: `Execute a SQL SELECT query. IMPORTANT: You must call get_dataset_schema first to get the exact tableName and column names.
Use the tableName from get_dataset_schema (e.g., "dataset_sales_2024") in your FROM clause.
The resultKey becomes the dataPath in render_ui (e.g., resultKey "sales" -> dataPath "/sales").`,
    schema: z.object({
      query: z.string().describe('The SQL SELECT query using exact tableName and column names from get_dataset_schema'),
      resultKey: z.string().describe('A unique key to store results under (used as dataPath in render_ui)'),
    }),
  }
)

interface ExecuteDatasetQueryInput {
  query: string
  resultKey: string
}

type ExecuteDatasetQueryResult =
  | {
      success: true
      resultKey: string
      query: string
      rowCount: number
      columns: string[]
      data: Record<string, unknown>[]
    }
  | {
      error: string
      availableTables?: string[]
      hint?: string
      correctColumnNames?: string[]
      exampleQuery?: string
    }

export async function executeDatasetQuery({
  query,
  resultKey,
}: ExecuteDatasetQueryInput): Promise<ExecuteDatasetQueryResult> {
    const validation = validateSelectQuery(query)
    if (!validation.valid) {
      return { error: validation.error ?? 'Invalid query' }
    }

    const tableName = extractTableFromQuery(query)
    if (!tableName) {
      return { error: 'Could not parse table name from query. Ensure your query has a valid FROM clause.' }
    }

    const availableTables = await getAvailableTables()
    const tableNameLower = tableName.toLowerCase()

    if (!availableTables.has(tableNameLower)) {
      const tableNames = Array.from(availableTables.keys())
      return {
        error: `Table "${tableName}" not found.`,
        availableTables: tableNames,
        hint: 'Use the exact tableName from get_dataset_schema (e.g., "dataset_sales_2024"). Did you call get_dataset_schema first?',
      }
    }

    const tableInfo = availableTables.get(tableNameLower)!

    try {
      const sql = getSql()
      const rows = await sql.query(query, [])

      return {
        success: true,
        resultKey,
        query,
        rowCount: rows.length,
        columns: rows.length > 0 ? Object.keys(rows[0]) : [],
        data: rows as Record<string, unknown>[],
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)

      if (errorMessage.includes('column') && errorMessage.includes('does not exist')) {
        const exampleCols = tableInfo.originalColumns.slice(0, 5).map(c => `"${c}"`).join(', ')
        return {
          error: `Query failed: ${errorMessage}`,
          correctColumnNames: tableInfo.originalColumns,
          exampleQuery: `SELECT ${exampleCols} FROM "${tableName}" LIMIT 10`,
          hint: 'COPY column names exactly as shown in correctColumnNames. Use double quotes around column names.',
        }
      }

      return {
        error: `Query failed: ${errorMessage}`,
        hint: 'Check that you are using the exact tableName and column names from get_dataset_schema.',
      }
    }
}

export const datasetTools = [listDatasetsTool, getDatasetSchemaTool, queryDatasetTool]
