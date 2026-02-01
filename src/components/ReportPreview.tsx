'use client'

import { useRef } from 'react'
import { Download } from 'lucide-react'
import type { Report, QueryResult } from '../lib/types'
import { ReportSectionRenderer } from './ReportSection'

interface ReportPreviewProps {
  report: Report
  queryResults: QueryResult[]
}

export function ReportPreview({ report, queryResults }: ReportPreviewProps) {
  const reportRef = useRef<HTMLDivElement>(null)

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow || !reportRef.current) return

    const content = reportRef.current.innerHTML

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${report.title}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
              line-height: 1.6;
              color: #1a1a1a;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
            }

            .report-header {
              margin-bottom: 32px;
              padding-bottom: 24px;
              border-bottom: 2px solid #e5e5e5;
            }

            .report-title {
              font-size: 28px;
              font-weight: 700;
              margin-bottom: 8px;
              color: #111;
            }

            .report-meta {
              color: #666;
              font-size: 14px;
            }

            .report-recipient {
              margin-bottom: 24px;
              font-size: 15px;
            }

            .report-intro {
              margin-bottom: 32px;
              font-size: 15px;
              line-height: 1.7;
            }

            .report-section {
              margin-bottom: 32px;
            }

            .section-title {
              font-size: 18px;
              font-weight: 600;
              margin-bottom: 12px;
              color: #111;
            }

            .section-content {
              font-size: 15px;
              line-height: 1.7;
              margin-bottom: 16px;
            }

            .section-source {
              font-size: 12px;
              color: #666;
              font-style: italic;
            }

            .metric-display {
              display: inline-block;
              background: #f5f5f5;
              padding: 16px 24px;
              border-radius: 8px;
              margin: 8px 0;
            }

            .metric-value {
              font-size: 32px;
              font-weight: 700;
              color: #111;
            }

            .metric-label {
              font-size: 14px;
              color: #666;
            }

            .chart-container {
              margin: 16px 0;
              padding: 16px;
              background: #fafafa;
              border-radius: 8px;
            }

            .table-container {
              margin: 16px 0;
              overflow-x: auto;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 14px;
            }

            th, td {
              padding: 10px 12px;
              text-align: left;
              border-bottom: 1px solid #e5e5e5;
            }

            th {
              font-weight: 600;
              background: #f5f5f5;
            }

            .call-to-action {
              margin: 32px 0;
              padding: 20px;
              background: #f0f7ff;
              border-left: 4px solid #2563eb;
              border-radius: 0 8px 8px 0;
            }

            .report-closing {
              margin-top: 32px;
              font-size: 15px;
            }

            .report-sources {
              margin-top: 40px;
              padding-top: 24px;
              border-top: 1px solid #e5e5e5;
            }

            .sources-title {
              font-size: 14px;
              font-weight: 600;
              margin-bottom: 12px;
              color: #666;
            }

            .sources-list {
              list-style: none;
              font-size: 13px;
              color: #666;
            }

            .sources-list li {
              margin-bottom: 4px;
            }

            @media print {
              body {
                padding: 20px;
              }
              .chart-container {
                break-inside: avoid;
              }
              .report-section {
                break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          ${content}
        </body>
      </html>
    `)

    printWindow.document.close()
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }

  const data: Record<string, unknown> = {}
  queryResults.forEach((qr) => {
    data[qr.resultKey] = qr.data
  })

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-3">
        <span className="text-sm font-medium text-gray-600">Report Preview</span>
        <button
          type="button"
          onClick={handleExportPDF}
          className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
        >
          <Download className="h-4 w-4" />
          Export PDF
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
        <div
          ref={reportRef}
          className="mx-auto max-w-3xl rounded-lg bg-white p-8 shadow-sm"
        >
          <div className="report-header mb-8 border-b-2 border-gray-200 pb-6">
            <h1 className="report-title mb-2 text-2xl font-bold text-gray-900">
              {report.title}
            </h1>
            <p className="report-meta text-sm text-gray-500">
              {report.lga} • {report.date}
            </p>
          </div>

          <div className="report-recipient mb-6">
            <p className="text-gray-700">Dear {report.recipient},</p>
          </div>

          <div className="report-intro mb-8">
            <p className="leading-relaxed text-gray-700">{report.introduction}</p>
          </div>

          {report.sections.map((section, index) => (
            <ReportSectionRenderer
              key={index}
              section={section}
              data={data}
            />
          ))}

          <div className="call-to-action my-8 rounded-r-lg border-l-4 border-blue-600 bg-blue-50 p-5">
            <p className="font-medium text-gray-800">{report.callToAction}</p>
          </div>

          <div className="report-closing mt-8">
            <p className="text-gray-700">{report.closing}</p>
          </div>

          {report.sources.length > 0 && (
            <div className="report-sources mt-10 border-t border-gray-200 pt-6">
              <h3 className="sources-title mb-3 text-sm font-semibold text-gray-500">
                Data Sources
              </h3>
              <ul className="sources-list space-y-1 text-sm text-gray-500">
                {report.sources.map((source, index) => (
                  <li key={index}>• {source}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
