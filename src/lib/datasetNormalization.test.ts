import { describe, expect, it } from 'vitest'

import {
  normalizeColumns,
  normalizeDatasetName,
  sanitizeTableName,
} from './datasetNormalization'

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
})
