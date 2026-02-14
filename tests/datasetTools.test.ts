import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/db', () => ({
  db: {},
  datasets: {},
}))

vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(),
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
}))

vi.mock('@langchain/core/tools', () => ({
  tool: vi.fn((fn, config) => ({ fn, config })),
}))

import { validateSelectQuery } from '@/lib/datasetTools'

describe('validateSelectQuery', () => {
  it('allows valid SELECT queries', () => {
    expect(validateSelectQuery('SELECT * FROM users').valid).toBe(true)
    expect(validateSelectQuery('select name FROM users WHERE age > 18').valid).toBe(true)
    expect(validateSelectQuery('   SELECT * FROM users').valid).toBe(true)
  })

  it('rejects empty and non-SELECT queries', () => {
    expect(validateSelectQuery('').valid).toBe(false)
    expect(validateSelectQuery('SHOW TABLES').valid).toBe(false)
    expect(validateSelectQuery('   ').valid).toBe(false)
  })

  it('rejects all forbidden SQL keywords', () => {
    const forbidden = ['drop', 'delete', 'insert', 'update', 'alter', 'create', 'truncate', 'grant', 'revoke']
    forbidden.forEach(keyword => {
      const result = validateSelectQuery(`SELECT * FROM t; ${keyword} x`)
      expect(result.valid).toBe(false)
      expect(result.error).toBe(`Forbidden keyword: ${keyword}`)
    })
  })

  it('rejects forbidden keywords regardless of case', () => {
    expect(validateSelectQuery('SELECT * FROM t; DROP x').valid).toBe(false)
    expect(validateSelectQuery('SELECT * FROM t; drop x').valid).toBe(false)
    expect(validateSelectQuery('SELECT * FROM t; DrOp x').valid).toBe(false)
  })

  it('allows column/table names containing forbidden substrings', () => {
    expect(validateSelectQuery('SELECT updated_at FROM users').valid).toBe(true)
    expect(validateSelectQuery('SELECT * FROM user_updates').valid).toBe(true)
    expect(validateSelectQuery('SELECT created_at, deleted_flag FROM logs').valid).toBe(true)
  })
})
