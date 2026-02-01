import { useState, useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  verifyAdminPassword,
  listDatasets,
  toggleDataset,
  deleteDataset,
  createDatasetTable,
  insertDatasetBatch,
  finalizeDataset,
  deleteDatasetTable,
  getDatasetPreview,
  type Dataset,
} from '../../server/admin'
import type { ColumnInfo } from '../../db/schema'
import { Upload, Trash2, Eye, Database, X, Check } from 'lucide-react'
import * as Papa from 'papaparse'

function inferColumnType(values: string[]): ColumnInfo['type'] {
  const nonEmpty = values.filter((v) => v !== '' && v !== null && v !== undefined)
  if (nonEmpty.length === 0) return 'text'

  const allNumeric = nonEmpty.every((v) => {
    const cleaned = v.replace(/[\s,]/g, '')
    return cleaned !== '' && !isNaN(Number(cleaned))
  })
  if (allNumeric) return 'numeric'

  const allBoolean = nonEmpty.every((v) =>
    ['true', 'false', '1', '0', 'yes', 'no'].includes(v.toLowerCase())
  )
  if (allBoolean) return 'boolean'

  const datePattern = /^\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}/
  const allDates = nonEmpty.every((v) => datePattern.test(v))
  if (allDates) return 'date'

  return 'text'
}

function ProgressStage({
  label,
  active,
  completed,
}: {
  label: string
  active: boolean
  completed: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
          completed
            ? 'bg-green-500 text-white'
            : active
              ? 'border-2 border-blue-500 bg-blue-50'
              : 'border-2 border-gray-200 bg-white'
        }`}
      >
        {completed && <Check size={14} />}
        {active && <div className="h-2 w-2 rounded-full bg-blue-500" />}
      </div>
      <span
        className={`text-sm ${completed ? 'text-green-600' : active ? 'font-medium text-blue-600' : 'text-gray-400'}`}
      >
        {label}
      </span>
    </div>
  )
}

export const Route = createFileRoute('/admin/')({
  component: AdminPage,
  ssr: false,
})

function AdminPage() {
  const [password, setPassword] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showUpload, setShowUpload] = useState(false)
  const [uploadStep, setUploadStep] = useState<'select' | 'preview' | 'uploading'>('select')
  const [fileName, setFileName] = useState('')
  const [previewData, setPreviewData] = useState<{
    columns: ColumnInfo[]
    sampleRows: Record<string, string>[]
    totalRows: number
    suggestedName: string
  } | null>(null)
  const [datasetName, setDatasetName] = useState('')
  const [datasetDescription, setDatasetDescription] = useState('')
  const [columns, setColumns] = useState<ColumnInfo[]>([])

  const [previewModal, setPreviewModal] = useState<{
    dataset: Dataset
    rows: Record<string, unknown>[]
  } | null>(null)

  const [uploadProgress, setUploadProgress] = useState<{
    stage: 'parsing' | 'creating' | 'inserting' | 'finalizing'
    totalRows: number
    insertedRows?: number
  } | null>(null)
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([])

  const handleLogin = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await verifyAdminPassword({ data: { password } })
      if (result.valid) {
        setIsAuthenticated(true)
        await loadDatasets()
      } else {
        setError('Invalid password')
      }
    } catch {
      setError('Failed to verify password')
    } finally {
      setIsLoading(false)
    }
  }

  const loadDatasets = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await listDatasets({ data: { password } })
      setDatasets(result)
    } catch {
      setError('Failed to load datasets')
    } finally {
      setIsLoading(false)
    }
  }, [password])

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await toggleDataset({ data: { password, id, enabled } })
      setDatasets((prev) => prev.map((d) => (d.id === id ? { ...d, enabled } : d)))
    } catch {
      setError('Failed to toggle dataset')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure? This will delete the dataset and all its data.')) return
    try {
      await deleteDataset({ data: { password, id } })
      setDatasets((prev) => prev.filter((d) => d.id !== id))
    } catch {
      setError('Failed to delete dataset')
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please select a CSV file')
      return
    }

    const maxSize = 100 * 1024 * 1024 // 100MB
    if (file.size > maxSize) {
      setError(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 100MB.`)
      return
    }

    setFileName(file.name)

    try {
      const content = await file.text()

      if (!content.trim()) {
        setError('File is empty')
        return
      }

      const parsed = Papa.parse<Record<string, string>>(content, {
        header: true,
        skipEmptyLines: true,
      })

      if (parsed.errors.length > 0) {
        const errorDetails = parsed.errors.slice(0, 3).map((e) => `Row ${e.row}: ${e.message}`).join('; ')
        setError(`CSV parsing errors: ${errorDetails}`)
        return
      }

      const headers = parsed.meta.fields || []
      if (headers.length === 0) {
        setError('No columns detected in CSV. Check that the file has headers.')
        return
      }

      const cols: ColumnInfo[] = headers.map((header) => {
        const values = parsed.data.map((row) => row[header])
        const inferredType = inferColumnType(values)
        return {
          name: header,
          type: inferredType,
          originalType: inferredType,
        }
      })

      setParsedRows(parsed.data)
      setPreviewData({
        columns: cols,
        sampleRows: parsed.data.slice(0, 10),
        totalRows: parsed.data.length,
        suggestedName: file.name.replace(/\.csv$/i, ''),
      })
      setDatasetName(file.name.replace(/\.csv$/i, ''))
      setColumns(cols)
      setUploadStep('preview')
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to parse CSV'
      setError(`CSV parsing failed: ${errorMsg}`)
    }
  }

  const handleColumnTypeChange = (index: number, type: ColumnInfo['type']) => {
    setColumns((prev) => prev.map((col, i) => (i === index ? { ...col, type } : col)))
  }

  const handleUpload = async () => {
    setUploadStep('uploading')
    setError(null)
    const totalRows = parsedRows.length

    let tableName = ''

    try {
      setUploadProgress({ stage: 'creating', totalRows, insertedRows: 0 })

      const tableResult = await createDatasetTable({
        data: { password, name: datasetName, columns },
      })
      tableName = tableResult.tableName

      setUploadProgress({ stage: 'inserting', totalRows, insertedRows: 0 })

      const batchSize = 500
      let insertedRows = 0

      for (let i = 0; i < parsedRows.length; i += batchSize) {
        const batch = parsedRows.slice(i, i + batchSize)
        await insertDatasetBatch({
          data: { password, tableName, columns, rows: batch },
        })
        insertedRows += batch.length
        setUploadProgress({ stage: 'inserting', totalRows, insertedRows })
      }

      setUploadProgress({ stage: 'finalizing', totalRows, insertedRows: totalRows })

      await finalizeDataset({
        data: {
          password,
          name: datasetName,
          description: datasetDescription,
          tableName,
          columns,
          rowCount: totalRows,
        },
      })

      await loadDatasets()
      resetUpload()
    } catch (err) {
      if (tableName) {
        try {
          await deleteDatasetTable({ data: { password, tableName } })
        } catch {}
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload dataset'
      setError(errorMessage)
      setUploadStep('preview')
      setUploadProgress(null)
    }
  }

  const resetUpload = () => {
    setShowUpload(false)
    setUploadStep('select')
    setFileName('')
    setPreviewData(null)
    setDatasetName('')
    setDatasetDescription('')
    setColumns([])
    setUploadProgress(null)
    setParsedRows([])
    setError(null)
  }

  const handlePreview = async (dataset: Dataset) => {
    try {
      const result = await getDatasetPreview({ data: { password, id: dataset.id } })
      setPreviewModal({ dataset: result.dataset, rows: result.rows })
    } catch {
      setError('Failed to load preview')
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="mb-4 text-xl font-semibold text-gray-900">Admin Access</h1>
          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="Enter password"
            className="mb-4 w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Verifying...' : 'Login'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Dataset Manager</h1>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            <Upload size={18} />
            Upload CSV
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">
              Dismiss
            </button>
          </div>
        )}

        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Rows</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Columns</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Enabled</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {datasets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    <Database className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                    No datasets yet. Upload a CSV to get started.
                  </td>
                </tr>
              ) : (
                datasets.map((dataset) => (
                  <tr key={dataset.id} className="border-b border-gray-100">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{dataset.name}</div>
                      {dataset.description && (
                        <div className="text-sm text-gray-500">{dataset.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{dataset.rowCount}</td>
                    <td className="px-4 py-3 text-gray-600">{dataset.columns.length}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggle(dataset.id, !dataset.enabled)}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          dataset.enabled
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {dataset.enabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handlePreview(dataset)}
                          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                          title="Preview"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(dataset.id)}
                          className="rounded p-1 text-gray-500 hover:bg-red-100 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showUpload && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-lg bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Upload Dataset</h2>
              <button onClick={resetUpload} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <div className="font-medium">Upload Error</div>
                <div className="mt-1 whitespace-pre-wrap">{error}</div>
              </div>
            )}

            {uploadStep === 'select' && (
              <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
                <Upload className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                <p className="mb-4 text-gray-600">Select a CSV file to upload</p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  className="cursor-pointer rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                >
                  Choose File
                </label>
              </div>
            )}

            {uploadStep === 'preview' && previewData && (
              <div>
                <div className="mb-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Dataset Name
                    </label>
                    <input
                      type="text"
                      value={datasetName}
                      onChange={(e) => setDatasetName(e.target.value)}
                      className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Description (optional)
                    </label>
                    <input
                      type="text"
                      value={datasetDescription}
                      onChange={(e) => setDatasetDescription(e.target.value)}
                      className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <p className="mb-2 text-sm text-gray-600">
                  {previewData.totalRows} rows detected from {fileName}
                </p>

                <div className="mb-4">
                  <h3 className="mb-2 font-medium">Column Types (auto-detected, adjustable)</h3>
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {columns.map((col, i) => (
                      <div key={col.name} className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm" title={col.name}>
                          {col.name}
                        </span>
                        <select
                          value={col.type}
                          onChange={(e) =>
                            handleColumnTypeChange(i, e.target.value as ColumnInfo['type'])
                          }
                          className="rounded border border-gray-300 px-2 py-1 text-sm"
                        >
                          <option value="text">Text</option>
                          <option value="numeric">Numeric</option>
                          <option value="boolean">Boolean</option>
                          <option value="date">Date</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <h3 className="mb-2 font-medium">Sample Data (first 10 rows)</h3>
                  <div className="overflow-x-auto rounded border border-gray-200">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          {columns.map((col) => (
                            <th
                              key={col.name}
                              className="whitespace-nowrap px-3 py-2 text-left font-medium text-gray-700"
                            >
                              {col.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.sampleRows.map((row, i) => (
                          <tr key={i} className="border-t border-gray-100">
                            {columns.map((col) => (
                              <td
                                key={col.name}
                                className="max-w-[200px] truncate whitespace-nowrap px-3 py-2 text-gray-600"
                              >
                                {row[col.name]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={resetUpload}
                    className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={!datasetName}
                    className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Upload Dataset
                  </button>
                </div>
              </div>
            )}

            {uploadStep === 'uploading' && uploadProgress && (
              <div className="py-6">
                <div className="mb-6 flex justify-center">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                </div>

                <div className="mx-auto max-w-md space-y-3">
                  <ProgressStage
                    label="Parsing CSV"
                    active={uploadProgress.stage === 'parsing'}
                    completed={['creating', 'inserting', 'finalizing'].includes(uploadProgress.stage)}
                  />
                  <ProgressStage
                    label="Creating database table"
                    active={uploadProgress.stage === 'creating'}
                    completed={['inserting', 'finalizing'].includes(uploadProgress.stage)}
                  />
                  <ProgressStage
                    label={
                      uploadProgress.stage === 'inserting' && uploadProgress.insertedRows !== undefined
                        ? `Inserting rows (${uploadProgress.insertedRows.toLocaleString()} / ${uploadProgress.totalRows.toLocaleString()})`
                        : `Inserting ${uploadProgress.totalRows.toLocaleString()} rows`
                    }
                    active={uploadProgress.stage === 'inserting'}
                    completed={uploadProgress.stage === 'finalizing'}
                  />
                  <ProgressStage
                    label="Finalizing"
                    active={uploadProgress.stage === 'finalizing'}
                    completed={false}
                  />
                </div>

                {uploadProgress.stage === 'inserting' && uploadProgress.insertedRows !== undefined && (
                  <div className="mx-auto mt-6 max-w-md">
                    <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full bg-blue-600 transition-all duration-300"
                        style={{
                          width: `${Math.round((uploadProgress.insertedRows / uploadProgress.totalRows) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="mt-2 text-center text-sm text-gray-600">
                      {Math.round((uploadProgress.insertedRows / uploadProgress.totalRows) * 100)}%
                    </p>
                  </div>
                )}

                <p className="mt-6 text-center text-sm text-gray-500">
                  Please wait, this may take a moment for large datasets...
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {previewModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-lg bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">{previewModal.dataset.name}</h2>
              <button
                onClick={() => setPreviewModal(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <div className="mb-4">
              <h3 className="mb-2 font-medium">Schema</h3>
              <div className="flex flex-wrap gap-2">
                {previewModal.dataset.columns.map((col) => (
                  <span
                    key={col.name}
                    className="rounded bg-gray-100 px-2 py-1 text-sm text-gray-700"
                  >
                    {col.name}: <span className="text-gray-500">{col.type}</span>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2 font-medium">Sample Data (first 10 rows)</h3>
              <div className="overflow-x-auto rounded border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      {previewModal.dataset.columns.map((col) => (
                        <th
                          key={col.name}
                          className="whitespace-nowrap px-3 py-2 text-left font-medium text-gray-700"
                        >
                          {col.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewModal.rows.map((row, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        {previewModal.dataset.columns.map((col) => (
                          <td
                            key={col.name}
                            className="max-w-[200px] truncate whitespace-nowrap px-3 py-2 text-gray-600"
                          >
                            {String(row[col.name] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
