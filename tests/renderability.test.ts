import { describe, expect, it } from 'vitest'

import {
  buildQueryResultData,
  collectArtifactRenderabilityIssues,
  hasRenderableReport,
  isReportSectionRenderable,
  pruneNonRenderableReport,
  pruneNonRenderableUi,
  resolveRenderableRowsForDataPath,
  sanitizeArtifactContent,
  toResultKey,
} from '@/lib/renderability'
import type { NestedUIElement, QueryResult, Report } from '@/lib/types'

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

describe('toResultKey', () => {
  it('extracts the first path segment from a data path', () => {
    expect(toResultKey('/crime_trend')).toBe('crime_trend')
    expect(toResultKey('/nested/path')).toBe('nested')
  })

  it('returns null for empty or missing paths', () => {
    expect(toResultKey(undefined)).toBeNull()
    expect(toResultKey('')).toBeNull()
    expect(toResultKey('/')).toBeNull()
  })
})

describe('buildQueryResultData', () => {
  it('converts query results into a keyed data object', () => {
    const data = buildQueryResultData([
      { resultKey: 'crime', data: [{ year: 2024 }] },
      { resultKey: 'housing', data: [{ price: 500000 }] },
    ])

    expect(data).toEqual({
      crime: [{ year: 2024 }],
      housing: [{ price: 500000 }],
    })
  })

  it('returns empty object for empty input', () => {
    expect(buildQueryResultData([])).toEqual({})
  })
})

describe('isReportSectionRenderable', () => {
  it('considers text sections with content as renderable', () => {
    expect(isReportSectionRenderable({ type: 'text', title: 'Summary', content: 'Some text' }, {})).toBe(true)
  })

  it('considers empty text sections as non-renderable', () => {
    expect(isReportSectionRenderable({ type: 'text', title: 'Summary', content: '   ' }, {})).toBe(false)
  })
})

describe('hasRenderableReport', () => {
  it('returns false for null report', () => {
    expect(hasRenderableReport(null, {})).toBe(false)
  })

  it('returns true when report has introduction text', () => {
    const report: Report = {
      title: 'Test',
      lga: 'Test',
      date: '2026-01-01',
      introduction: 'Some intro',
      callToAction: '',
      closing: '',
      sources: [],
      sections: [],
    }
    expect(hasRenderableReport(report, {})).toBe(true)
  })
})
