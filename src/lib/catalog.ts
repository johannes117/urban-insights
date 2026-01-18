import { createCatalog } from '@json-render/core'
import { z } from 'zod'

export const catalog = createCatalog({
  components: {
    Card: {
      props: z.object({
        title: z.string().describe('Card title'),
      }),
      hasChildren: true,
    },
    Metric: {
      props: z.object({
        label: z.string().describe('Metric label'),
        value: z.string().describe('Metric value'),
        trend: z.enum(['up', 'down', 'flat']).optional().describe('Trend direction'),
      }),
    },
    Table: {
      props: z.object({
        columns: z.array(z.string()).describe('Column headers'),
        dataPath: z.string().describe('JSON pointer to data array'),
      }),
    },
    BarChart: {
      props: z.object({
        title: z.string().describe('Chart title'),
        dataPath: z.string().describe('JSON pointer to data array'),
        xKey: z.string().describe('Key for x-axis values'),
        yKey: z.string().describe('Key for y-axis values'),
      }),
    },
    LineChart: {
      props: z.object({
        title: z.string().describe('Chart title'),
        dataPath: z.string().describe('JSON pointer to data array'),
        xKey: z.string().describe('Key for x-axis values'),
        yKey: z.string().describe('Key for y-axis values'),
      }),
    },
    PieChart: {
      props: z.object({
        title: z.string().describe('Chart title'),
        dataPath: z.string().describe('JSON pointer to data array'),
        nameKey: z.string().describe('Key for segment names'),
        valueKey: z.string().describe('Key for segment values'),
      }),
    },
    Text: {
      props: z.object({
        content: z.string().describe('Text content'),
        variant: z.enum(['heading', 'subheading', 'paragraph', 'caption']).optional().describe('Text variant'),
      }),
    },
    Grid: {
      props: z.object({
        columns: z.number().optional().describe('Number of columns (default 2)'),
      }),
      hasChildren: true,
    },
    List: {
      props: z.object({
        dataPath: z.string().describe('JSON pointer to data array'),
        itemTemplate: z.string().describe('Template for each item using {field} syntax'),
      }),
    },
  },
  actions: {
    refresh: { description: 'Refresh the data' },
    export: { description: 'Export data as CSV' },
  },
})

export type Catalog = typeof catalog
