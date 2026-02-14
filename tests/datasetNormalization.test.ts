import { describe, expect, it } from 'vitest'

import {
  normalizeColumns,
  normalizeColumnName,
  normalizeDatasetName,
  normalizeLookupKey,
  makeUniqueIdentifier,
  sanitizeTableName,
} from '@/lib/datasetNormalization'

describe('datasetNormalization', () => {
  it('normalizes dataset names to lowercase snake_case', () => {
    expect(normalizeDatasetName('Victorian Crime Data 2025.csv')).toBe('victorian_crime_data_2025_csv')
  })

  it('builds lowercase table names with dataset_ prefix', () => {
    expect(sanitizeTableName('Victorian Crime Data 2025')).toBe('dataset_victorian_crime_data_2025')
  })

  it('normalizes and de-duplicates column names', () => {
    const columns = normalizeColumns([
      { name: 'LGA Name', type: 'text', originalType: 'text' },
      { name: 'lga-name', type: 'text', originalType: 'text' },
      { name: 'Median Rent ($)', type: 'numeric', originalType: 'numeric' },
    ])

    expect(columns.map((column) => column.name)).toEqual([
      'lga_name',
      'lga_name_2',
      'median_rent',
    ])
  })

  it('normalizes lookup keys to lowercase snake_case', () => {
    expect(normalizeLookupKey('LGA Name')).toBe('lga_name')
    expect(normalizeLookupKey('APR-JUN 2025')).toBe('apr_jun_2025')
    expect(normalizeLookupKey('  hello  ')).toBe('hello')
  })

  it('normalizes column names and falls back for empty input', () => {
    expect(normalizeColumnName('Crime Count', 0)).toBe('crime_count')
    expect(normalizeColumnName('', 2)).toBe('column_3')
    expect(normalizeColumnName('!!!', 0)).toBe('column_1')
  })

  it('generates unique identifiers with collision handling', () => {
    const used = new Set<string>()
    expect(makeUniqueIdentifier('name', used)).toBe('name')
    expect(makeUniqueIdentifier('name', used)).toBe('name_2')
    expect(makeUniqueIdentifier('name', used)).toBe('name_3')
  })

  it('returns fallback for empty dataset name', () => {
    expect(normalizeDatasetName('')).toBe('dataset')
    expect(normalizeDatasetName('   ')).toBe('dataset')
  })
})
