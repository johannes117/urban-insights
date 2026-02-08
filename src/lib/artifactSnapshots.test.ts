import { describe, expect, it } from 'vitest'

import { buildArtifactDataSnapshot, mergeQueryResultsWithSnapshot } from './artifactSnapshots'
import type { QueryResult } from './types'

describe('artifactSnapshots', () => {
  it('creates a compact snapshot using only required chart fields', () => {
    const snapshot = buildArtifactDataSnapshot({
      ui: {
        type: 'BarChart',
        props: {
          dataPath: '/crime_trend',
          xKey: 'year',
          yKey: 'count',
        },
      },
      queryResults: [
        {
          resultKey: 'crime_trend',
          data: [
            { year: 2024, count: 10, ignored: 'x' },
            { year: 2025, count: 12, ignored: 'y' },
          ],
        },
      ],
    })

    expect(snapshot).toEqual({
      crime_trend: [
        { year: 2024, count: 10 },
        { year: 2025, count: 12 },
      ],
    })
  })

  it('hydrates render data from snapshot when query result rows are missing', () => {
    const queryResults: QueryResult[] = [
      {
        resultKey: 'geelong_crime',
        data: [],
        query: 'SELECT * FROM crime',
      },
    ]

    const merged = mergeQueryResultsWithSnapshot(queryResults, {
      geelong_crime: [{ type: 'Theft', count: 42 }],
    })

    expect(merged).toEqual([
      {
        resultKey: 'geelong_crime',
        data: [{ type: 'Theft', count: 42 }],
        query: 'SELECT * FROM crime',
        partial: true,
      },
    ])
  })
})
