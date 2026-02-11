const cacheStore = new Map<string, any>()

export function setCache(key: string, value: any) {
  cacheStore.set(key, value)
}

export function getCache(key: string) {
  return cacheStore.get(key)
}

export function clearCache() {
  cacheStore.clear()
}
