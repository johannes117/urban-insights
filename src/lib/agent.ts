import { createDeepAgent } from 'deepagents'
import { tool } from '@langchain/core/tools'
import { ChatAnthropic } from '@langchain/anthropic'
import { ChatGroq } from '@langchain/groq'
import { z } from 'zod/v3'
import { mockData, type MockDataKey } from './mockData'
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

WORKFLOW FOR DATABASE QUERIES:
1. First call list_datasets to see available datasets
2. Call get_dataset_schema to understand a dataset's structure and see sample data
3. Use query_dataset to run SQL queries - provide a resultKey (e.g., "sales_data")
4. Use that resultKey as dataPath in render_ui (e.g., dataPath: "/sales_data")

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

DEMO DATA (for testing without database):
These paths have built-in demo data:
- /monthlyRevenue - { month, revenue }
- /quarterlyGrowth - { quarter, growth }
- /topProducts - { name, sales, revenue }
- /userMetrics - { totalUsers, activeUsers, etc. }
- /salesByRegion - { region, sales }
- /recentOrders - { id, customer, amount, status }
- /websiteTraffic - { day, visitors }
- /categoryBreakdown - { category, value }

EXAMPLE - Using database data:
1. query_dataset({ query: "SELECT month, revenue FROM dataset_sales ORDER BY month", resultKey: "monthly" })
2. render_ui({ ui: { type: "BarChart", props: { title: "Revenue", dataPath: "/monthly", xKey: "month", yKey: "revenue" } } })

IMPORTANT: Always call render_ui tool when creating visualizations. A brief text response + the tool call is the correct pattern.`

const getDataTool = tool(
  async ({ dataKey }) => {
    const data = mockData[dataKey as MockDataKey]
    if (!data) {
      return JSON.stringify({ error: `Data key "${dataKey}" not found. Available keys: ${Object.keys(mockData).join(', ')}` })
    }
    return JSON.stringify(data)
  },
  {
    name: 'get_data',
    description: 'Get data for visualizations. Available keys: monthlyRevenue, quarterlyGrowth, topProducts, userMetrics, salesByRegion, recentOrders, websiteTraffic, categoryBreakdown',
    schema: z.object({
      dataKey: z.string().describe('The key of the data to retrieve'),
    }),
  }
)

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
    tools: [getDataTool, renderUiTool, ...datasetTools],
  })
}

export type Agent = ReturnType<typeof createAgent>
