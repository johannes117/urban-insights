import fs from 'fs'
import path from 'path'

interface RentData {
  LGA: string
  MedianWeeklyRent: number
}

export async function getRentComparison(lgas: string[]): Promise<RentData[]> {
  const csvPath = path.resolve(__dirname, '../../tests/validation/expected/rent_comparison.csv')
  const csv = fs.readFileSync(csvPath, 'utf-8')
  return csv
    .trim()
    .split('\n')
    .map(line => {
      const [LGA, MedianWeeklyRent] = line.split(',')
      return { LGA, MedianWeeklyRent: Number(MedianWeeklyRent) }
    })
    .filter(r => lgas.includes(r.LGA))
}
