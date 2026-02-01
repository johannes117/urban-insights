import { pgTable, uuid, text, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core'

export interface ColumnInfo {
  name: string
  type: 'text' | 'numeric' | 'boolean' | 'date'
  originalType: string
}

export const datasets = pgTable('datasets', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  tableName: text('table_name').notNull().unique(),
  columns: jsonb('columns').$type<ColumnInfo[]>().notNull(),
  rowCount: text('row_count').notNull().default('0'),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type Dataset = typeof datasets.$inferSelect
export type NewDataset = typeof datasets.$inferInsert
