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
      datasets: results.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        tableName: d.tableName,
        rowCount: d.rowCount,
        columns: d.columns.map((c) => `${c.name} (${c.type})`).join(', '),
      })),
    })
  },
  {
    name: 'list_datasets',
    description:
      'List all available datasets that can be queried. Returns dataset names, descriptions, column info, and row counts. Call this first to see what data is available.',
    schema: z.object({}),
  }
)

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
        error: `Dataset "${datasetName}" not found.`,
        availableDatasets: allDatasets.map((d) => d.name),
      })
    }

    if (!dataset.enabled) {
      return JSON.stringify({ error: `Dataset "${datasetName}" is currently disabled.` })
    }

    const sql = getSql()
    const sampleRows = await sql.query(`SELECT * FROM "${dataset.tableName}" LIMIT 10`, [])

    return JSON.stringify({
      name: dataset.name,
      description: dataset.description,
      tableName: dataset.tableName,
      totalRows: dataset.rowCount,
      columns: dataset.columns,
      sampleRows,
    })
  },
  {
    name: 'get_dataset_schema',
    description:
      'Get detailed schema information and sample data for a specific dataset. Use this to understand the structure before writing queries. Returns column names, types, and first 10 rows.',
    schema: z.object({
      datasetName: z.string().describe('The name of the dataset to inspect'),
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

export const queryDatasetTool = tool(
  async ({ query, resultKey }) => {
    const validation = validateSelectQuery(query)
    if (!validation.valid) {
      return JSON.stringify({ error: validation.error })
    }

    try {
      const sql = getSql()
      const rows = await sql.query(query, [])

      return JSON.stringify({
        success: true,
        resultKey,
        rowCount: rows.length,
        columns: rows.length > 0 ? Object.keys(rows[0]) : [],
        data: rows,
      })
    } catch (err) {
      return JSON.stringify({
        error: `Query failed: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  },
  {
    name: 'query_dataset',
    description: `Execute a SQL SELECT query on the database. Only SELECT queries are allowed.
Use the tableName from list_datasets or get_dataset_schema (e.g., "dataset_sales_2024").
The resultKey you provide will be used as the dataPath in render_ui (e.g., resultKey "sales" -> dataPath "/sales").
You can run multiple queries and use different resultKeys to combine data in visualizations.`,
    schema: z.object({
      query: z.string().describe('The SQL SELECT query to execute'),
      resultKey: z.string().describe('A unique key to store results under (used as dataPath in render_ui)'),
    }),
  }
)

export const datasetTools = [listDatasetsTool, getDatasetSchemaTool, queryDatasetTool]
