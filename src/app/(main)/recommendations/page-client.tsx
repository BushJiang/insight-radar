'use client'

import { useCallback, useEffect, useState } from 'react'
import { AppShell } from '@/components/app/app-shell'
import { RecommendationExplanationCard } from '@/components/recommendations/recommendation-explanation-card'
import { RecommendationRequestPanel } from '@/components/recommendations/recommendation-request-panel'
import { getDefaultPreference, normalizePreference, preferenceStorageKey } from '@/lib/default-preference'
import { readBrowserStorage } from '@/lib/browser-storage'
import { readTransientFormState, writeTransientRecommendationFormState } from '@/lib/transient-form-state'
import type { GithubProject, ProjectProfileProgress, ProjectSearchFilters, RecommendationExplanation, SearchProjectsResponse } from '@/types/insight-radar'

interface RecommendationsPageClientProps {
  initialProjects: GithubProject[]
}

const initialProgress: ProjectProfileProgress = {
  status: 'ready',
  completedCount: 0,
  totalCount: 0,
  message: null,
}

export default function RecommendationsPageClient({ initialProjects }: RecommendationsPageClientProps) {
  const recommendationDraft = readTransientFormState().recommendations
  const [recommendationLimit, setRecommendationLimit] = useState(recommendationDraft.recommendationLimit)
  const [filters, setFilters] = useState(recommendationDraft.filters)
  const [query, setQuery] = useState(recommendationDraft.query)
  const [recommendations, setRecommendations] = useState<RecommendationExplanation[]>(recommendationDraft.recommendations)
  const [projects, setProjects] = useState(initialProjects)
  const [sources, setSources] = useState<string[]>([])
  const [sourcesLoaded, setSourcesLoaded] = useState(false)
  const [progress, setProgress] = useState<ProjectProfileProgress>(initialProgress)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canGenerateProfiles = progress.totalCount > progress.completedCount

  useEffect(() => {
    let cancelled = false

    async function loadProfileStatus() {
      try {
        const result = await requestProjectProfiles('status', filters, [])

        if (!cancelled) {
          setProgress(result.progress)
        }
      } catch {
        if (!cancelled) {
          setProgress(initialProgress)
        }
      }
    }

    void loadProfileStatus()

    return () => {
      cancelled = true
    }
  }, [filters])

  async function ensureSourcesLoaded() {
    if (sourcesLoaded) {
      return
    }

    try {
      const response = await fetch('/api/projects/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: {
            query: '',
            languages: [],
            maturity: [],
            sourceGithubUsername: null,
            days: null,
          },
          page: 1,
          pageSize: 1,
        }),
      })
      const result = await response.json() as SearchProjectsResponse

      setSources(result.sources)
      setSourcesLoaded(true)
    } catch {
      setSourcesLoaded(true)
    }
  }

  const handleRecommend = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          filters,
          recommendationLimit,
          preference: normalizePreference(readBrowserStorage(preferenceStorageKey, getDefaultPreference())),
        }),
      })
      const result = await response.json() as { progress: ProjectProfileProgress; recommendation: RecommendationExplanation | null; projects: GithubProject[]; error: string | null }

      setProgress(result.progress)
      if (!response.ok || result.error) {
        setError(result.error || '智能推荐失败，请稍后重试。')
        return
      }

      if (result.progress.status !== 'ready') {
        setError('请先生成项目简介，再执行智能推荐。')
        return
      }

      if (result.projects.length > 0) {
        setProjects(result.projects)
      }

      if (result.recommendation) {
        setRecommendations([result.recommendation])
        writeTransientRecommendationFormState({ recommendations: [result.recommendation] })
      }
    } catch {
      setError('智能推荐失败，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }, [filters, query, recommendationLimit])

  const handleGenerateProfiles = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      let processedRepositoryIds: string[] = []
      let stableProgress = initialProgress

      while (true) {
        const result = await requestProjectProfiles('generate', filters, processedRepositoryIds)
        processedRepositoryIds = result.processedRepositoryIds
        stableProgress = resolveStableProgress(stableProgress, result.progress)

        setProgress(stableProgress)
        if (result.error) {
          setError(result.error)
          return
        }

        if (result.progress.status !== 'running') {
          return
        }
      }
    } catch {
      setError('项目简介生成失败，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }, [filters])

  const handleRegenerateProfiles = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      let processedRepositoryIds: string[] = []

      while (true) {
        const result = await requestProjectProfiles('regenerate', filters, processedRepositoryIds)
        processedRepositoryIds = result.processedRepositoryIds

        setProgress(result.progress)
        if (result.error) {
          setError(result.error)
          return
        }

        if (result.progress.status !== 'running') {
          return
        }
      }
    } catch {
      setError('项目简介生成失败，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }, [filters])

  return (
    <AppShell currentPath="/recommendations">
      <main className="space-y-6">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">智能推荐</h2>
          </div>
          <RecommendationRequestPanel
            query={query}
            filters={filters}
            sources={sources}
            loading={loading}
            canGenerateProfiles={canGenerateProfiles}
            recommendationLimit={recommendationLimit}
            onQueryChange={(nextQuery) => {
              setQuery(nextQuery)
              writeTransientRecommendationFormState({ query: nextQuery })
            }}
            onFiltersChange={(nextFilters) => {
              const resolvedFilters = { ...filters, ...nextFilters }
              setFilters(resolvedFilters)
              writeTransientRecommendationFormState({ filters: resolvedFilters })
            }}
            onRecommendationLimitChange={(limit) => {
              setRecommendationLimit(limit)
              writeTransientRecommendationFormState({ recommendationLimit: limit })
            }}
            onSourceInputFocus={ensureSourcesLoaded}
            onSubmit={() => void handleRecommend()}
            onGenerateProfiles={() => void handleGenerateProfiles()}
            onRegenerateProfiles={() => void handleRegenerateProfiles()}
          />
          <ProjectProfileProgressCard progress={progress} />
          {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div> : null}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">推荐结果</h2>
          </div>
          {recommendations.length > 0 ? recommendations.map((recommendation) => (
            <RecommendationExplanationCard key={recommendation.id} recommendation={recommendation} projects={projects} />
          )) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
              输入项目需求并点击智能推荐后，这里会展示推荐结果。
            </div>
          )}
        </section>
      </main>
    </AppShell>
  )
}

async function requestProjectProfiles(action: 'status' | 'generate' | 'regenerate', filters: ProjectSearchFilters, processedRepositoryIds: string[]) {
  const response = await fetch('/api/project-profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      filters,
      preference: normalizePreference(readBrowserStorage(preferenceStorageKey, getDefaultPreference())),
      processedRepositoryIds,
    }),
  })
  const result = await response.json() as { progress: ProjectProfileProgress; processedRepositoryIds: string[]; error: string | null }

  if (!response.ok && !result.error) {
    return { ...result, error: '项目简介生成失败，请稍后重试。' }
  }

  return result
}

function resolveStableProgress(currentProgress: ProjectProfileProgress, nextProgress: ProjectProfileProgress): ProjectProfileProgress {
  if (nextProgress.status === 'ready') {
    return currentProgress.totalCount > 0
      ? { ...nextProgress, completedCount: currentProgress.totalCount, totalCount: currentProgress.totalCount }
      : nextProgress
  }

  if (nextProgress.status !== 'running') {
    return nextProgress
  }

  const totalCount = Math.max(currentProgress.totalCount, nextProgress.totalCount)
  const previouslyCompletedCount = Math.max(0, currentProgress.totalCount - nextProgress.totalCount)
  const completedCount = Math.max(currentProgress.completedCount, previouslyCompletedCount + nextProgress.completedCount)

  return {
    ...nextProgress,
    completedCount: Math.min(completedCount, totalCount),
    totalCount,
  }
}

function ProjectProfileProgressCard({ progress }: { progress: ProjectProfileProgress }) {
  if (progress.status === 'ready' && progress.totalCount === 0) {
    return null
  }

  const percent = progress.totalCount > 0 ? Math.round((progress.completedCount / progress.totalCount) * 100) : 0

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{progress.message || '项目简介已准备完成'}</p>
        <p className="text-sm tabular-nums text-slate-500 dark:text-slate-400">{progress.completedCount}/{progress.totalCount}</p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
