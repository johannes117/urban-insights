import { describe, expect, it } from 'vitest'

import {
  collectArtifactRenderabilityIssues,
  pruneNonRenderableReport,
  pruneNonRenderableUi,
  resolveRenderableRowsForDataPath,
  sanitizeArtifactContent,
} from './renderability'
import type { NestedUIElement, QueryResult, Report } from './types'

describe('renderability', () => {
  it('normalizes required keys case-insensitively for chart rows', () => {
    const data = {
      crime: [{ Year: 2024, Count: 11 }],
    }

    const result = resolveRenderableRowsForDataPath(data, '/crime', {
      requiredKeys: ['year', 'count'],
      requireAllKeys: true,
    })

    expect(result.error).toBeNull()
    expect(result.rows).toEqual([{ Year: 2024, Count: 11, year: 2024, count: 11 }])
  })

  it('normalizes required keys using punctuation-insensitive matching', () => {
    const data = {
      housing: [{ apr_jun_2025: 960000, change_yoy: 0.7 }],
    }

    const result = resolveRenderableRowsForDataPath(data, '/housing', {
      requiredKeys: ['APR-JUN 2025', '% CHANGE YOY'],
      requireAllKeys: true,
      requireKeyCoverage: 'all',
    })

    expect(result.error).toBeNull()
    expect(result.rows).toEqual([
      {
        apr_jun_2025: 960000,
        change_yoy: 0.7,
        'APR-JUN 2025': 960000,
        '% CHANGE YOY': 0.7,
      },
    ])
  })

  it('prunes a non-renderable UI tree that only contains empty chart elements', () => {
    const ui: NestedUIElement = {
      type: 'Grid',
      children: [
        {
          type: 'BarChart',
          props: {
            title: 'Crime Trend',
            dataPath: '/crime',
            xKey: 'year',
            yKey: 'count',
          },
        },
      ],
    }

    const pruned = pruneNonRenderableUi(ui, { crime: [] })
    expect(pruned).toBeNull()
  })

  it('keeps renderable chart UI when data exists with case mismatches', () => {
    const ui: NestedUIElement = {
      type: 'BarChart',
      props: {
        title: 'Crime Trend',
        dataPath: '/crime',
        xKey: 'year',
        yKey: 'count',
      },
    }

    const pruned = pruneNonRenderableUi(ui, {
      crime: [{ Year: 2024, Count: 11 }],
    })

    expect(pruned).not.toBeNull()
  })

  it('removes non-renderable report chart sections while keeping text sections', () => {
    const report: Report = {
      title: 'Community Safety',
      lga: 'Test LGA',
      date: '2026-02-12',
      introduction: 'Intro',
      callToAction: 'Please act.',
      closing: 'Thanks.',
      sources: [],
      sections: [
        {
          type: 'chart',
          title: 'Chart',
          chartType: 'bar',
          dataPath: '/crime',
          xKey: 'year',
          yKey: 'count',
        },
        {
          type: 'text',
          title: 'Summary',
          content: 'Crime has increased year over year.',
        },
      ],
    }

    const pruned = pruneNonRenderableReport(report, { crime: [] })
    expect(pruned?.sections).toHaveLength(1)
    expect(pruned?.sections[0]?.type).toBe('text')
  })

  it('flags artifact payload as non-renderable when visualization has no usable data', () => {
    const queryResults: QueryResult[] = [
      {
        resultKey: 'crime',
        data: [],
      },
    ]

    const result = sanitizeArtifactContent({
      ui: {
        type: 'BarChart',
        props: {
          title: 'Crime Trend',
          dataPath: '/crime',
          xKey: 'year',
          yKey: 'count',
        },
      },
      queryResults,
    })

    expect(result.ui).toBeNull()
    expect(result.hasRenderableContent).toBe(false)
  })

  it('rejects tables when not all requested columns can be resolved', () => {
    const result = resolveRenderableRowsForDataPath(
      {
        suburbs: [{ suburb: 'Ocean Grove' }],
      },
      '/suburbs',
      {
        requiredKeys: ['suburb', 'APR-JUN 2025', '% CHANGE YOY'],
        requireAllKeys: false,
        requireKeyCoverage: 'all',
      }
    )

    expect(result.rows).toEqual([])
    expect(result.error).toContain('Missing required fields')
  })

  it('reports renderability issues with available keys for LLM repair', () => {
    const issues = collectArtifactRenderabilityIssues({
      ui: {
        type: 'Table',
        props: {
          columns: ['Suburb', 'Apr-Jun 2025', '% Change YoY'],
          dataPath: '/geelong_house_values',
        },
      },
      queryResults: [
        {
          resultKey: 'geelong_house_values',
          data: [{ suburb: 'Ocean Grove', apr_jun_2025: 960000 }],
        },
      ],
    })

    expect(issues).toHaveLength(1)
    expect(issues[0]?.availableKeys).toEqual(['suburb', 'apr_jun_2025'])
  })
})
