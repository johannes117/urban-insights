export interface ChartDataResult<T = unknown[]> {
  data: T
  isEmpty: boolean
  error: string | null
}

export function resolveDataPath(
  data: Record<string, unknown>,
  dataPath: string,
  componentName: string
): ChartDataResult {
  const pathParts = dataPath.replace(/^\//, '').split('/')
  let current = data as Record<string, unknown>

  for (const part of pathParts) {
    if (current === undefined || current === null) {
      console.warn(
        `[${componentName}] Data path "${dataPath}" failed: parent is ${current} at part "${part}". Available keys at root:`,
        Object.keys(data)
      )
      return { data: [], isEmpty: true, error: `Data not found at path "${dataPath}"` }
    }

    if (!(part in current)) {
      console.warn(
        `[${componentName}] Data path "${dataPath}" failed: key "${part}" not found. Available keys:`,
        Object.keys(current)
      )
      return { data: [], isEmpty: true, error: `Key "${part}" not found in data` }
    }

    current = current[part] as Record<string, unknown>
  }

  if (!Array.isArray(current)) {
    console.warn(
      `[${componentName}] Data at path "${dataPath}" is not an array:`,
      typeof current
    )
    return { data: [], isEmpty: true, error: `Data at "${dataPath}" is not an array` }
  }

  if (current.length === 0) {
    console.warn(`[${componentName}] Data at path "${dataPath}" is an empty array`)
    return { data: [], isEmpty: true, error: null }
  }

  return { data: current, isEmpty: false, error: null }
}
