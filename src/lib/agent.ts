import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGroq } from "@langchain/groq";
import { tool } from "@langchain/core/tools";
import { z } from "zod/v3";
import { StateGraph, MessagesAnnotation, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
  BaseMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { datasetTools } from "./datasetTools";

export function createModel() {
  if (process.env.GROQ_API_KEY) {
    return new ChatGroq({
      model: "moonshotai/kimi-k2-instruct-0905",
      apiKey: process.env.GROQ_API_KEY,
    });
  }
  return new ChatAnthropic({
    model: "claude-haiku-4-5-20251001",
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
}

const uiElementSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    type: z.string(),
    props: z.record(z.unknown()).optional(),
    children: z.array(uiElementSchema).optional(),
  }),
);

const renderUiTool = tool(
  async ({ ui }) => {
    return JSON.stringify({ success: true, ui });
  },
  {
    name: "render_ui",
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
      ui: uiElementSchema.describe("The UI tree to render"),
    }),
  },
);

const reportSectionSchema = z.object({
  type: z.enum(["text", "chart", "table", "metric"]),
  title: z.string().optional(),
  content: z.string().optional(),
  dataPath: z.string().optional(),
  chartType: z.enum(["bar", "line", "pie"]).optional(),
  xKey: z.string().optional(),
  yKey: z.string().optional(),
  nameKey: z.string().optional(),
  valueKey: z.string().optional(),
  columns: z.array(z.string()).optional(),
  source: z.string().optional(),
});

const reportSchema = z.object({
  title: z.string(),
  lga: z.string(),
  date: z.string(),
  introduction: z.string(),
  sections: z.array(reportSectionSchema),
  callToAction: z.string(),
  closing: z.string(),
  sources: z.array(z.string()),
});

const renderReportTool = tool(
  async ({ report }) => {
    return JSON.stringify({ success: true, report });
  },
  {
    name: "render_report",
    description: `Generate a formal report that the user can export as PDF to send to their local council member or representative.

Use this tool when the user wants to:
- Create a report for their council/local member
- Generate a formal document about local issues
- Prepare advocacy materials with data

REPORT STRUCTURE:
- title: Report title (e.g., "Housing Affordability Crisis in [LGA]")
- lga: The local government area
- date: Current date
- introduction: Opening paragraph establishing the sender as a local resident and stating purpose
- sections: Array of content sections (see below)
- callToAction: Specific ask or request (e.g., "I urge the council to increase funding for...")
- closing: Closing statement (e.g., "Thank you for your attention to this matter.")
- sources: Array of data source citations

SECTION TYPES:
1. text: { type: "text", title?: string, content: string, source?: string }
   - For narrative explanations and analysis

2. metric: { type: "metric", title: string, content: string, source?: string }
   - For highlighting a single key statistic (content is the value, e.g., "42%")

3. chart: { type: "chart", title: string, chartType: "bar"|"line"|"pie", dataPath: string, xKey/yKey or nameKey/valueKey, source?: string }
   - For data visualizations. dataPath should be "/" + resultKey from query_dataset

4. table: { type: "table", title?: string, columns: string[], dataPath: string, source?: string }
   - For tabular data

GUIDELINES:
- Keep language professional but accessible
- Lead with the most impactful findings
- Include specific data points with sources
- Make the call to action specific and actionable
- Use charts to illustrate trends and comparisons
- Always cite data sources`,
    schema: z.object({
      report: reportSchema.describe("The report content"),
    }),
  },
);

function buildSystemPrompt(): string {
  return `You are a data exploration assistant helping users understand and analyze datasets about their local government area (LGA). Your role is to answer questions, find insights, and help users explore their data through conversation. You can also help users create formal reports to send to their local council members or representatives.

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

REPORT GENERATION:
When the user wants to create a report (they might say "create a report", "write to my council", "generate a report for my local member", etc.):
1. First, gather context by asking clarifying questions:
   - Who is this report for? (council member name, mayor, department)
   - What issue or concern are they addressing?
   - What outcome do they want? (awareness, funding, policy change)
2. Based on the conversation history and their answers, identify relevant data to include
3. Query the data to get current statistics
4. Use render_report to generate a professional report with:
   - Clear introduction establishing context
   - Key findings with supporting data and charts
   - Specific, actionable call to action
   - Proper source citations
5. The user can then ask for edits conversationally (e.g., "make it shorter", "add the crime data", "change the tone")

Remember: Users may not know what data is available or relevant. Proactively suggest statistics and visualizations that strengthen their case. Help them understand what makes an effective advocacy document.

RESPONSE STYLE:
- Be concise but informative
- Lead with the answer/insight, then provide supporting details
- No emojis`;
}

const allTools = [renderUiTool, renderReportTool, ...datasetTools];

function shouldContinue(
  state: typeof MessagesAnnotation.State,
): "tools" | typeof END {
  const lastMessage = state.messages[state.messages.length - 1];
  if (
    lastMessage &&
    "tool_calls" in lastMessage &&
    Array.isArray(lastMessage.tool_calls) &&
    lastMessage.tool_calls.length > 0
  ) {
    return "tools";
  }
  return END;
}

export function createAgent() {
  const model = createModel().bindTools(allTools);
  const systemPrompt = buildSystemPrompt();

  async function callModel(state: typeof MessagesAnnotation.State) {
    const messagesWithSystem = [
      new SystemMessage(systemPrompt),
      ...state.messages,
    ];
    const response = await model.invoke(messagesWithSystem);
    return { messages: [response] };
  }

  const toolNode = new ToolNode(allTools);

  const graph = new StateGraph(MessagesAnnotation)
    .addNode("agent", callModel)
    .addNode("tools", toolNode)
    .addEdge("__start__", "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent");

  return graph.compile();
}

export type Agent = ReturnType<typeof createAgent>;
