import { describe, it, expect } from 'vitest'
import { getRentComparison } from './comparisonService'

describe('getRentComparison', () => {
  it('returns correct median weekly rent per LGA', async () => {
    const result = await getRentComparison(['Collingwood', 'Ripponlea'])
    expect(result).toEqual([
      { LGA: 'Collingwood', MedianWeeklyRent: 451 },
      { LGA: 'Ripponlea', MedianWeeklyRent: 436 },
    ])
  })
})
