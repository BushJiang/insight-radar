import { useCallback, useSyncExternalStore } from 'react'

const browserStorageEventName = 'insight-radar-browser-storage'
const browserStorageSnapshotCache = new Map<string, { rawValue: string | null; parsedValue: unknown }>()

export function readBrowserStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback
  }

  return readBrowserStorageSnapshot(key, fallback)
}

export function writeBrowserStorage<T>(key: string, value: T) {
  if (typeof window === 'undefined') {
    return
  }

  const rawValue = JSON.stringify(value)
  window.localStorage.setItem(key, rawValue)
  browserStorageSnapshotCache.set(key, { rawValue, parsedValue: value })
  window.dispatchEvent(new CustomEvent(browserStorageEventName, { detail: { key } }))
}

export function useBrowserStorage<T>(key: string, fallback: T) {
  const subscribe = useCallback((onStoreChange: () => void) => {
    if (typeof window === 'undefined') {
      return () => undefined
    }

    function handleStorage(event: Event) {
      if (event instanceof StorageEvent && event.key !== key) {
        return
      }

      if (event instanceof CustomEvent && event.detail?.key !== key) {
        return
      }

      onStoreChange()
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener(browserStorageEventName, handleStorage)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener(browserStorageEventName, handleStorage)
    }
  }, [key])

  const getSnapshot = useCallback(() => readBrowserStorageSnapshot(key, fallback), [key, fallback])
  const getServerSnapshot = useCallback(() => fallback, [fallback])
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setValue = useCallback((nextValue: T) => {
    writeBrowserStorage(key, nextValue)
  }, [key])

  return [value, setValue] as const
}

function readBrowserStorageSnapshot<T>(key: string, fallback: T): T {
  const rawValue = window.localStorage.getItem(key)
  const cachedSnapshot = browserStorageSnapshotCache.get(key)

  if (cachedSnapshot?.rawValue === rawValue) {
    return cachedSnapshot.parsedValue as T
  }

  const parsedValue = parseBrowserStorageValue(rawValue, fallback)
  browserStorageSnapshotCache.set(key, { rawValue, parsedValue })

  return parsedValue
}

function parseBrowserStorageValue<T>(rawValue: string | null, fallback: T): T {
  if (!rawValue) {
    return fallback
  }

  try {
    return JSON.parse(rawValue) as T
  } catch {
    return typeof fallback === 'string' ? rawValue as T : fallback
  }
}
