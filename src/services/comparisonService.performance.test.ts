import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { getRentComparison } from './comparisonService'

const mockDataPath = path.resolve(__dirname, '../../tests/fixtures/mockLargeData.json')

// Define a type for the JSON structure
interface RentData {
  LGA: string
  [key: string]: any // other fields 
}

describe('getRentComparison performance', () => {
  it('handles large data sets efficiently', async () => {
    const fileContents = fs.readFileSync(mockDataPath, 'utf-8')
    const largeData: RentData[] = JSON.parse(fileContents) // explicitly typed

    const lgAs: string[] = largeData.map((d: RentData) => d.LGA) // type-safe mapping

    const start = performance.now()
    const result = await getRentComparison(lgAs)
    const duration = performance.now() - start

    expect(result.length).toBe(largeData.length)
    expect(duration).toBeLessThan(500) // 500ms threshold
  })
})


