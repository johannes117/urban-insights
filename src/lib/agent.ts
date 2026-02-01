import { anthropic } from "@ai-sdk/anthropic";
import { streamText, generateText, tool, stepCountIs } from "ai";
import { z } from "zod/v3";
import {
  listDatasets,
  getDatasetSchema,
  queryDataset,
} from "./datasetTools";

const uiElementSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    type: z.string(),
    props: z.record(z.unknown()).optional(),
    children: z.array(uiElementSchema).optional(),
  })
);

function buildSystemPrompt(lgaContext?: string): string {
  const lgaSection = lgaContext
    ? `
USER CONTEXT:
The user has selected: ${lgaContext}
When querying datasets, filter by this LGA where applicable. Look for columns like "lga_name", "lga", "council", or similar that match this area.
`
    : "";

  return `You are an agent that helps users understand data about their local government areas. You are able to query datasets and create visual dashboards.
${lgaSection}

NO EMOJIS.

You should chat with the user to understand what they want to know about their LGA. If they are unsure, look at the available datasets, and suggest what they could look at.

If you wish to retrieve some data for an answer or visualization, you can follow these steps:
STEP 1: DISCOVER - Call list_datasets to see available data

STEP 2: GET SCHEMA - For EACH dataset you want to query (You should only use relevant datasets for the user's question or topic):
- Call get_dataset_schema with the dataset "name"
- The response includes:
  - "tableName": Use this in your SQL FROM clause
  - "exactColumnNames": COPY THESE EXACTLY into your SQL
  - "exampleQuery": A ready-to-use query template
  - "lgaColumn": Which column to filter by for LGA data

STEP 3: QUERY - Copy column names EXACTLY from schema
- Use double quotes around column names: SELECT "Column_Name" FROM "tableName"
- If query fails, the error shows correct column names - use those

STEP 4: (if you want to create a visualization) RENDER - Call render_ui with dataPath = "/" + your resultKey

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

ERROR HANDLING:
- If a tool call fails, read the error message carefully and fix the issue
- Do NOT retry the same exact call more than once - adjust based on the error
- If you get a column name error, use the correct names from the error response
- If you get a table name error, use list_datasets to find correct names

STYLE: No emojis. Be professional and concise, but informative.
Users are trying to understand and learn about their LGA's, you need guide them in interpreting the data. Try to find key outliers and insights in the data and point them out if anything is unusual.`;
}

const tools = {
  list_datasets: tool({
    description:
      "List all available datasets. Returns dataset names, descriptions, column info, and row counts. After calling this, you MUST call get_dataset_schema for each dataset you want to query - never query a dataset without getting its schema first.",
    inputSchema: z.object({}),
    execute: async () => listDatasets(),
  }),
  get_dataset_schema: tool({
    description:
      "REQUIRED before any query_dataset call. Returns the exact tableName and column names you MUST use in queries. Copy column names exactly as shown.",
    inputSchema: z.object({
      datasetName: z
        .string()
        .describe(
          'The dataset name from list_datasets (e.g., "sales_2024", not "dataset_sales_2024")'
        ),
    }),
    execute: async ({ datasetName }) => getDatasetSchema({ datasetName }),
  }),
  query_dataset: tool({
    description: `Execute a SQL SELECT query. IMPORTANT: You must call get_dataset_schema first to get the exact tableName and column names.
Use the tableName from get_dataset_schema (e.g., "dataset_sales_2024") in your FROM clause.
The resultKey becomes the dataPath in render_ui (e.g., resultKey "sales" -> dataPath "/sales").`,
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          "The SQL SELECT query using exact tableName and column names from get_dataset_schema"
        ),
      resultKey: z
        .string()
        .describe(
          "A unique key to store results under (used as dataPath in render_ui)"
        ),
    }),
    execute: async ({ query, resultKey }) => queryDataset({ query, resultKey }),
  }),
  render_ui: tool({
    description:
      "Render UI components in the artifact panel. Pass a UI tree structure with type, props, and optional children.",
    inputSchema: z.object({
      ui: uiElementSchema.describe("The UI tree to render"),
    }),
    execute: async ({ ui }) => ({ success: true, ui }),
  }),
};

export interface AgentOptions {
  lgaContext?: string;
}

export type Message = {
  role: "user" | "assistant";
  content: string;
};

export async function runAgent(messages: Message[], options: AgentOptions = {}) {
  const result = await generateText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: buildSystemPrompt(options.lgaContext),
    messages,
    tools,
    stopWhen: stepCountIs(25),
  });

  return result;
}

export function streamAgent(messages: Message[], options: AgentOptions = {}) {
  return streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: buildSystemPrompt(options.lgaContext),
    messages,
    tools,
    stopWhen: stepCountIs(25),
  });
}
