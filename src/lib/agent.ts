import { createDeepAgent } from 'deepagents'
import { tool } from '@langchain/core/tools'
import { ChatAnthropic } from '@langchain/anthropic'
import { ChatGroq } from '@langchain/groq'
import { z } from 'zod/v3'
import { datasetTools } from './datasetTools'

function createModel() {
  if (process.env.GROQ_API_KEY) {
    return new ChatGroq({
      model: 'moonshotai/kimi-k2-instruct-0905',
      apiKey: process.env.GROQ_API_KEY,
    })
  }
  return new ChatAnthropic({
    model: 'claude-sonnet-4-5-20250929',
    apiKey: process.env.ANTHROPIC_API_KEY,
  })
}

const uiElementSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    type: z.string(),
    props: z.record(z.unknown()).optional(),
    children: z.array(uiElementSchema).optional(),
  })
)

function buildSystemPrompt(lgaContext?: string): string {
  const lgaSection = lgaContext
    ? `
USER CONTEXT:
The user has selected: ${lgaContext}
When querying datasets, filter by this LGA where applicable. Look for columns like "lga_name", "lga", "council", or similar that match this area.
`
    : ''

  return `You are a data visualization assistant that queries datasets and creates visual dashboards.
${lgaSection}
STRICT WORKFLOW - FOLLOW THESE STEPS IN ORDER:

STEP 1: DISCOVER - Call list_datasets to see available data

STEP 2: GET SCHEMA - For EACH dataset you want to query:
- Call get_dataset_schema with the dataset "name"
- The response includes:
  - "tableName": Use this in your SQL FROM clause
  - "exactColumnNames": COPY THESE EXACTLY into your SQL
  - "exampleQuery": A ready-to-use query template
  - "lgaColumn": Which column to filter by for LGA data

STEP 3: QUERY - Copy column names EXACTLY from schema
- Use double quotes around column names: SELECT "Column_Name" FROM "tableName"
- If query fails, the error shows correct column names - use those

STEP 4: RENDER - Call render_ui with dataPath = "/" + your resultKey

CRITICAL - COLUMN NAMES:
- Column names are CASE-SENSITIVE and often unexpected (e.g., "Tot_P_M" not "total_male")
- NEVER invent column names - ALWAYS copy from schema response
- The schema's "exactColumnNames" array has the correct names
- Use the "exampleQuery" from schema as a starting template

NUMERIC COLUMNS:
- Check the column "type" in schema - if it says "numeric", use it directly (SUM, AVG, etc.)
- Only if you get "invalid input syntax for type integer/numeric" error, the column is actually TEXT
- In that case, use: CAST(REPLACE(REPLACE(column, ',', ''), ' ', '') AS NUMERIC) to convert
- Do NOT use REPLACE on columns that are already numeric type - it will fail

NAMING:
- list_datasets "name" (e.g., "sales_2024") -> use for get_dataset_schema
- get_dataset_schema "tableName" (e.g., "dataset_sales_2024") -> use in SQL

UI COMPONENTS:
- Card: { title: string }, children allowed
- Metric: { label: string, value: string, trend?: "up"|"down"|"flat" }
- Text: { content: string, variant?: "heading"|"subheading"|"paragraph"|"caption" }
- Grid: { columns?: number }, children allowed
- Table: { columns: string[], dataPath: string }
- List: { dataPath: string, itemTemplate: string }
- BarChart/LineChart: { title: string, dataPath: string, xKey: string, yKey: string }
- PieChart: { title: string, dataPath: string, nameKey: string, valueKey: string }

EXAMPLE FLOW:
1. list_datasets() -> { datasets: [{ name: "sales_2024" }] }
2. get_dataset_schema({ datasetName: "sales_2024" }) -> { tableName: "dataset_sales_2024", exactColumnNames: ["Sale_Month", "Total_Rev"], exampleQuery: "SELECT \"Sale_Month\", \"Total_Rev\" FROM \"dataset_sales_2024\" LIMIT 10" }
3. query_dataset({ query: "SELECT \"Sale_Month\", \"Total_Rev\" FROM \"dataset_sales_2024\"", resultKey: "sales" })
4. render_ui({ ui: { type: "BarChart", props: { dataPath: "/sales", xKey: "Sale_Month", yKey: "Total_Rev" } } })

STYLE: No emojis. Brief responses.`
}

const renderUiTool = tool(
  async ({ ui }) => {
    return JSON.stringify({ success: true, ui })
  },
  {
    name: 'render_ui',
    description: 'Render UI components in the artifact panel. Pass a UI tree structure with type, props, and optional children.',
    schema: z.object({
      ui: uiElementSchema.describe('The UI tree to render'),
    }),
  }
)

export interface CreateAgentOptions {
  lgaContext?: string
}

export function createAgent(options: CreateAgentOptions = {}) {
  return createDeepAgent({
    model: createModel(),
    systemPrompt: buildSystemPrompt(options.lgaContext),
    tools: [renderUiTool, ...datasetTools],
  })
}

export type Agent = ReturnType<typeof createAgent>
