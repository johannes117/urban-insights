import { ChatAnthropic } from '@langchain/anthropic'
import { ChatGroq } from '@langchain/groq'
import { tool } from '@langchain/core/tools'
import { z } from 'zod/v3'
import { StateGraph, MessagesAnnotation, END } from '@langchain/langgraph'
import { ToolNode } from '@langchain/langgraph/prebuilt'
import { SystemMessage, HumanMessage, AIMessage, BaseMessage, ToolMessage } from '@langchain/core/messages'
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

const renderUiTool = tool(
  async ({ ui }) => {
    return JSON.stringify({ success: true, ui })
  },
  {
    name: 'render_ui',
    description: `Render a visualization in the artifact panel.

UI COMPONENTS:
- Card: { title: string } - container with title, can have children
- Metric: { label: string, value: string, trend?: "up"|"down"|"flat" } - single stat display
- Text: { content: string, variant?: "heading"|"subheading"|"paragraph"|"caption" }
- Grid: { columns?: number } - layout grid, can have children
- Table: { columns: string[], dataPath: string } - data table
- BarChart/LineChart: { title: string, dataPath: string, xKey: string, yKey: string }
- PieChart: { title: string, dataPath: string, nameKey: string, valueKey: string }

dataPath should be "/" + the resultKey from query_dataset (e.g., "/sales")`,
    schema: z.object({
      ui: uiElementSchema.describe('The UI tree to render'),
    }),
  }
)

function buildSystemPrompt(lgaContext?: string): string {
  const lgaSection = lgaContext
    ? `\nUSER CONTEXT: The user is interested in ${lgaContext}. When relevant, filter queries by this area using LGA columns.\n`
    : ''

  return `You are a data exploration assistant helping users understand and analyze datasets. Your role is to answer questions, find insights, and help users explore their data through conversation.
${lgaSection}
APPROACH:
- Be conversational and helpful. Answer questions directly.
- Use tools to query data when needed, then explain what you found.
- When presenting statistical breakdowns, trends, or comparisons, include a visualization (chart/table) alongside your text explanation - this helps users see patterns.
- For simple factual answers or single values, text alone is fine.

DATASET NAMES - CRITICAL:
- list_datasets returns a "name" field for each dataset - you MUST use this exact name when calling get_dataset_schema
- Never guess or modify dataset names - copy them exactly as returned
- Example: if list_datasets returns { name: "lga_crime_data" }, use "lga_crime_data" not "criminal_offences" or "crime"

WORKFLOW:
1. Call list_datasets to see available data and get exact dataset names
2. Call get_dataset_schema with the exact "name" from step 1 to get column info
3. Use query_dataset with exact column names from the schema
4. Explain results and add visualizations when showing breakdowns or trends

SQL TIPS:
- Column names must be quoted: SELECT "Column_Name" FROM "table_name"
- Copy column names exactly as shown in the schema
- For numeric operations on text columns, use: CAST(REPLACE(column, ',', '') AS NUMERIC)

RESPONSE STYLE:
- Be concise but informative
- Lead with the answer/insight, then provide supporting details
- No emojis`
}

const allTools = [renderUiTool, ...datasetTools]

function shouldContinue(state: typeof MessagesAnnotation.State): 'tools' | typeof END {
  const lastMessage = state.messages[state.messages.length - 1]
  if (lastMessage && 'tool_calls' in lastMessage && Array.isArray(lastMessage.tool_calls) && lastMessage.tool_calls.length > 0) {
    return 'tools'
  }
  return END
}

export interface CreateAgentOptions {
  lgaContext?: string
}

export function createAgent(options: CreateAgentOptions = {}) {
  const model = createModel().bindTools(allTools)
  const systemPrompt = buildSystemPrompt(options.lgaContext)

  async function callModel(state: typeof MessagesAnnotation.State) {
    const messagesWithSystem = [
      new SystemMessage(systemPrompt),
      ...state.messages,
    ]
    const response = await model.invoke(messagesWithSystem)
    return { messages: [response] }
  }

  const toolNode = new ToolNode(allTools)

  const graph = new StateGraph(MessagesAnnotation)
    .addNode('agent', callModel)
    .addNode('tools', toolNode)
    .addEdge('__start__', 'agent')
    .addConditionalEdges('agent', shouldContinue)
    .addEdge('tools', 'agent')

  return graph.compile()
}

export type Agent = ReturnType<typeof createAgent>
