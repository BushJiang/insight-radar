import { readBrowserStorage } from '@/lib/browser-storage'
import { getDefaultPreference, preferenceStorageKey } from '@/lib/default-preference'
import type { GithubStarredSearchResponse } from '@/types/insight-radar'

interface CollectGithubStarredProjectsParams {
  username: string
  days: string
  maxProjects: number
  onProgress?: (step: string) => void
}

// 流式采集：通过 ReadableStream 接收后端进度事件，实时更新弹窗步骤
export async function collectGithubStarredProjects({ username, days, maxProjects, onProgress }: CollectGithubStarredProjectsParams): Promise<GithubStarredSearchResponse> {
  const response = await fetch('/api/github/starred-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filters: {
        query: '',
        languages: [],
        maturity: [],
        sourceGithubUsername: username,
        days: days === 'all' ? null : Number(days),
      },
      maxProjects,
      preference: readBrowserStorage(preferenceStorageKey, getDefaultPreference()),
    }),
  })

  if (!response.ok || !response.body) {
    throw new Error(`采集请求失败，服务端返回 ${response.status}。`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result: GithubStarredSearchResponse | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) continue
      const event = JSON.parse(line) as { type: string; step?: string; error?: string | null; projects?: unknown[]; totalCount?: number; fetchedCount?: number; duplicateCount?: number; updatedDuplicateCount?: number; unchangedDuplicateCount?: number; estimatedTotalCount?: number | null }

      if (event.type === 'progress' && event.step) {
        onProgress?.(event.step)
      }

      if (event.type === 'error') {
        throw new Error(event.error || '采集失败。')
      }

      if (event.type === 'result') {
        result = event as unknown as GithubStarredSearchResponse
      }
    }
  }

  if (!result) {
    throw new Error('采集未返回有效结果。')
  }

  if (result.error) {
    throw new Error(result.error)
  }

  return result
}
