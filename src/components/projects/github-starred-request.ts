import { readBrowserStorage } from '@/lib/browser-storage'
import { getDefaultPreference, preferenceStorageKey } from '@/lib/default-preference'
import type { GithubStarredSearchResponse } from '@/types/insight-radar'

interface CollectGithubStarredProjectsParams {
  username: string
  days: string
  maxProjects: number
}

export async function collectGithubStarredProjects({ username, days, maxProjects }: CollectGithubStarredProjectsParams) {
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
      githubToken: readBrowserStorage('insight-radar-github-token', '') || undefined,
      maxProjects,
      preference: readBrowserStorage(preferenceStorageKey, getDefaultPreference()),
    }),
  })
  const rawResult = await response.text()
  const result = rawResult ? JSON.parse(rawResult) as GithubStarredSearchResponse : null

  if (!response.ok || result?.error || !result) {
    throw new Error(result?.error || `采集请求失败，服务端返回 ${response.status}。`)
  }

  return result
}
