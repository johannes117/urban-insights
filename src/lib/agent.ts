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

const systemPrompt = `You are a UI visualization assistant. Your PRIMARY job is to create visual components using tools.

CRITICAL: When the user asks for ANY visualization, chart, graph, dashboard, or data display:
1. You MUST call the render_ui tool to create the visualization
2. Do NOT just describe what you would create - actually call the tool
3. Keep your text response brief - the visualization speaks for itself

MANDATORY WORKFLOW FOR DATABASE QUERIES:
You MUST follow this exact sequence - never skip steps:

1. FIRST: Call get_dataset_schema to get the EXACT table name and column names
   - The schema response contains the precise column names you must use
   - NEVER guess or assume column names - always check schema first

2. THEN: Use query_dataset with the EXACT names from the schema
   - Use the exact table name returned by get_dataset_schema
   - Use the exact column names - they may have underscores, prefixes, or different casing
   - Provide a resultKey (e.g., "sales_data") for storing results

3. FINALLY: Call render_ui using that resultKey as dataPath (e.g., dataPath: "/sales_data")

IMPORTANT: If a query fails, check the schema again. Column names in this database often differ from what you might expect. Always verify against the schema before retrying.

You can run multiple queries with different resultKeys to combine data in one visualization.

AVAILABLE COMPONENTS:
- Card: Container with a title. Props: { title: string }. Can have children.
- Metric: Display a KPI value. Props: { label: string, value: string, trend?: "up" | "down" | "flat" }
- Text: Display text. Props: { content: string, variant?: "heading" | "subheading" | "paragraph" | "caption" }
- Grid: Layout grid. Props: { columns?: number }. Can have children.
- Table: Data table. Props: { columns: string[], dataPath: string }
- List: Simple list. Props: { dataPath: string, itemTemplate: string }
- BarChart: Bar chart. Props: { title: string, dataPath: string, xKey: string, yKey: string }
- LineChart: Line chart. Props: { title: string, dataPath: string, xKey: string, yKey: string }
- PieChart: Pie chart. Props: { title: string, dataPath: string, nameKey: string, valueKey: string }

EXAMPLE - Using database data:
1. get_dataset_schema({ datasetName: "dataset_sales" }) -> Returns columns: ["sale_month", "total_revenue", "region"]
2. query_dataset({ query: "SELECT sale_month, total_revenue FROM dataset_sales ORDER BY sale_month", resultKey: "monthly" })
3. render_ui({ ui: { type: "BarChart", props: { title: "Revenue", dataPath: "/monthly", xKey: "sale_month", yKey: "total_revenue" } } })

Note: The column names came from the schema (sale_month, total_revenue) - never assume column names like "month" or "revenue".

IMPORTANT: Always call render_ui tool when creating visualizations. A brief text response + the tool call is the correct pattern.

STYLE: Never use emojis in your responses. Keep text professional and clean.`

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

export function createAgent() {
  return createDeepAgent({
    model: createModel(),
    systemPrompt,
    tools: [renderUiTool, ...datasetTools],
  })
}

export type Agent = ReturnType<typeof createAgent>
