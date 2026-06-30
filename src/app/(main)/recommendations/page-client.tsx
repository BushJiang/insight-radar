// 智能推荐页客户端组件：管理推荐表单状态、AI 推荐请求，表单状态存模块内存（transient-form-state）
'use client'

import { useCallback, useEffect, useState } from 'react'
import { RecommendationExplanationCard } from '@/components/recommendations/recommendation-explanation-card'
import { RecommendationRequestPanel } from '@/components/recommendations/recommendation-request-panel'
import { RecommendationProgressDialog } from '@/components/recommendations/recommendation-progress-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorMessage } from '@/components/shared/error-message'
import { getDefaultPreference, normalizePreference, preferenceStorageKey } from '@/lib/default-preference'
import { readBrowserStorage } from '@/lib/browser-storage'
import { readTransientFormState, writeTransientRecommendationFormState } from '@/lib/transient-form-state'
import type { GithubProject, ProjectProfileProgress, ProjectSearchFilters, RecommendationExplanation, SearchProjectsResponse, VectorIndexStatus } from '@/types/insight-radar'

interface RecommendationsPageClientProps {
  initialProjects: GithubProject[]
}

export default function RecommendationsPageClient({ initialProjects }: RecommendationsPageClientProps) {
  const recommendationDraft = readTransientFormState().recommendations
  const [recommendationLimit, setRecommendationLimit] = useState(recommendationDraft.recommendationLimit)
  const [filters, setFilters] = useState(recommendationDraft.filters)
  const [query, setQuery] = useState(recommendationDraft.query)
  const [recommendations, setRecommendations] = useState<RecommendationExplanation[]>(recommendationDraft.recommendations)
  const [projects, setProjects] = useState(recommendationDraft.projects.length > 0 ? recommendationDraft.projects : initialProjects)
  const [sources, setSources] = useState<string[]>(() => mergeSelectedSource(recommendationDraft.sources, recommendationDraft.filters.sourceGithubUsername))
  const [sourcesLoaded, setSourcesLoaded] = useState(recommendationDraft.sourcesLoaded)
  const [loading, setLoading] = useState(false)
  const [recommending, setRecommending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 向量索引状态优先从缓存读取，切页不重查 API
  const [vectorStatus, setVectorStatus] = useState<VectorIndexStatus>(recommendationDraft.vectorStatus)
  const [vectorStatusLoaded, setVectorStatusLoaded] = useState(recommendationDraft.vectorStatusLoaded)
  const [syncingIndex, setSyncingIndex] = useState(false)
  // 推荐进度弹窗状态
  const [progressOpen, setProgressOpen] = useState(false)
  const [progressStep, setProgressStep] = useState(0)
  const [progressFailed, setProgressFailed] = useState(false)

  // 只在三种情况下查询向量索引状态：
  // 1. 首次访问（无缓存）
  // 2. 筛选条件变化（统计范围变了）
  // 3. 点击「更新数据库」后（handleSyncIndex 直接更新 state，不依赖此 effect）
  // 切页来回时筛选条件未变且缓存有效 → 跳过查询，直接展示缓存数据
  useEffect(() => {
    // 筛选条件未变且已有缓存 → 跳过，不显示加载中
    if (vectorStatusLoaded && recommendationDraft.vectorStatusFilters && isSameFilters(recommendationDraft.vectorStatusFilters, filters)) {
      return
    }

    let cancelled = false

    async function loadVectorStatus() {
      try {
        const result = await requestVectorStatus(filters)
        if (!cancelled) {
          const nextStatus = result.vectorStatus ?? { totalCount: 0, unprofiledCount: 0, indexedCount: 0, unindexedCount: 0, lastSyncAt: null }
          setVectorStatus(nextStatus)
          setVectorStatusLoaded(true)
          writeTransientRecommendationFormState({ vectorStatus: nextStatus, vectorStatusLoaded: true, vectorStatusFilters: { ...filters } })
        }
      } catch (error) {
        // API 失败时保持 loaded=false，卡片显示"加载中..."而非误导的"数据库为空"
        console.error('[recommendation] 数据库状态查询失败:', error instanceof Error ? error.message : String(error))
      }
    }

    void loadVectorStatus()

    return () => {
      cancelled = true
    }
  }, [filters, recommendationDraft.vectorStatusFilters, vectorStatusLoaded])

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

      if (!response.ok || result.error) {
        setSourcesLoaded(true)
        writeTransientRecommendationFormState({ sourcesLoaded: true })
        return
      }

      const nextSources = mergeSelectedSource(result.sources, filters.sourceGithubUsername)
      setSources(nextSources)
      setSourcesLoaded(true)
      writeTransientRecommendationFormState({ sources: nextSources, sourcesLoaded: true })
    } catch {
      setSourcesLoaded(true)
      writeTransientRecommendationFormState({ sourcesLoaded: true })
    }
  }

  const handleRecommend = useCallback(async () => {
    setLoading(true)
    setRecommending(true)
    setError(null)
    setProgressOpen(true)
    setProgressStep(0)
    setProgressFailed(false)

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

      if (!response.ok || !response.body) {
        setProgressFailed(true)
        setError('智能推荐失败，请稍后重试。')
        return
      }

      // 读取流式响应，每行一个 JSON 事件
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue
          const event = JSON.parse(line) as { type: string; step?: string; progress?: ProjectProfileProgress; recommendation?: RecommendationExplanation | null; projects?: GithubProject[]; error?: string | null }

          if (event.type === 'progress' && event.step) {
            const stepMap: Record<string, number> = { search: 0, analysis: 1, reasons: 2 }
            setProgressStep(stepMap[event.step] ?? 0)
          }

          if (event.type === 'error') {
            setProgressFailed(true)
            setError(event.error ?? '智能推荐失败，请稍后重试。')
            return
          }

          if (event.type === 'result') {
            if (event.progress?.status !== 'ready') {
              setProgressFailed(true)
              setError(`项目简介未就绪 (${event.progress?.completedCount ?? 0}/${event.progress?.totalCount ?? 0})，请重试。`)
              return
            }

            setProgressStep(3)
            window.setTimeout(() => setProgressOpen(false), 2400)

            if (event.projects && event.projects.length > 0) {
              setProjects(event.projects)
              writeTransientRecommendationFormState({ projects: event.projects })
            }

            if (event.recommendation) {
              setRecommendations([event.recommendation])
              writeTransientRecommendationFormState({ recommendations: [event.recommendation], projects: event.projects ?? [] })
            }
          }
        }
      }
    } catch {
      setProgressFailed(true)
      setError('智能推荐失败，请稍后重试。')
    } finally {
      setRecommending(false)
      setLoading(false)
    }
  }, [filters, query, recommendationLimit])

  const handleClearData = useCallback(async () => {
    if (!window.confirm('确定要清空所有项目数据和向量数据吗？此操作不可恢复。')) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/projects/clear', { method: 'POST' })
      const result = await response.json() as { ok: boolean; error: string | null }

      if (!response.ok || result.error) {
        setError(result.error || '清空数据库失败，请稍后重试。')
        return
      }

      setProjects([])
      setRecommendations([])
      setSources([])
      setSourcesLoaded(false)
      setVectorStatus({ totalCount: 0, unprofiledCount: 0, indexedCount: 0, unindexedCount: 0, lastSyncAt: null })
      setVectorStatusLoaded(false)
      writeTransientRecommendationFormState({ projects: [], recommendations: [], sources: [], sourcesLoaded: false, vectorStatus: { totalCount: 0, unprofiledCount: 0, indexedCount: 0, unindexedCount: 0, lastSyncAt: null }, vectorStatusLoaded: false, vectorStatusFilters: null })
    } catch {
      setError('清空数据库失败，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSyncIndex = useCallback(async () => {
    setSyncingIndex(true)
    setError(null)

    try {
      const result = await requestSyncVectors(filters)
      const nextStatus = result.vectorStatus ?? { totalCount: 0, unprofiledCount: 0, indexedCount: 0, unindexedCount: 0, lastSyncAt: null }
      setVectorStatus(nextStatus)
      writeTransientRecommendationFormState({ vectorStatus: nextStatus, vectorStatusFilters: { ...filters } })

      if (result.error) {
        setError(result.error)
      }
    } catch {
      setError('更新数据库失败，请稍后重试。')
    } finally {
      setSyncingIndex(false)
    }
  }, [filters])

  return (
    <main className="space-y-6">
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">智能推荐</h2>
        </div>
        <RecommendationRequestPanel
          query={query}
          filters={filters}
          sources={mergeSelectedSource(sources, filters.sourceGithubUsername)}
          loading={loading}
          recommending={recommending}
          recommendationLimit={recommendationLimit}
          onQueryChange={(nextQuery) => {
            setQuery(nextQuery)
            writeTransientRecommendationFormState({ query: nextQuery })
          }}
          onFiltersChange={(nextFilters) => {
            setFilters((prev) => {
              const resolvedFilters = { ...prev, ...nextFilters }
              const nextSources = mergeSelectedSource(sources, resolvedFilters.sourceGithubUsername)
              setSources(nextSources)
              writeTransientRecommendationFormState({ filters: resolvedFilters, sources: nextSources })
              return resolvedFilters
            })
          }}
          onRecommendationLimitChange={(limit) => {
            setRecommendationLimit(limit)
            writeTransientRecommendationFormState({ recommendationLimit: limit })
          }}
          onSourceInputFocus={ensureSourcesLoaded}
          onSubmit={() => void handleRecommend()}
          onSyncIndex={() => void handleSyncIndex()}
          onClearData={() => void handleClearData()}
          syncingIndex={syncingIndex}
          canSyncIndex={vectorStatus.unprofiledCount > 0 || vectorStatus.unindexedCount > 0}
        />
        <VectorIndexStatusCard vectorStatus={vectorStatus} loaded={vectorStatusLoaded} />
        <RecommendationProgressDialog
          open={progressOpen}
          stepIndex={progressStep}
          failed={progressFailed}
          errorMessage={error}
          onClose={() => setProgressOpen(false)}
        />
        {error ? <ErrorMessage message={error} /> : null}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">推荐结果</h2>
        </div>
        {recommendations.length > 0 ? recommendations.map((recommendation) => (
          <RecommendationExplanationCard key={recommendation.id} recommendation={recommendation} projects={projects} />
        )) : (
          <EmptyState message="输入项目需求并点击智能推荐后，这里会展示推荐结果。" />
        )}
      </section>
    </main>
  )
}

async function requestVectorStatus(filters: ProjectSearchFilters) {
  const response = await fetch('/api/project-profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'vector-status', filters }),
  })
  return await response.json() as { vectorStatus?: VectorIndexStatus; error: string | null }
}

async function requestSyncVectors(filters: ProjectSearchFilters) {
  const response = await fetch('/api/project-profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'sync-vectors',
      filters,
      preference: normalizePreference(readBrowserStorage(preferenceStorageKey, getDefaultPreference())),
    }),
  })
  return await response.json() as { vectorStatus?: VectorIndexStatus; syncedCount?: number; error: string | null }
}

// 比较两个筛选条件是否相同，用于判断向量索引状态是否需要重新查询
function isSameFilters(left: ProjectSearchFilters | null, right: ProjectSearchFilters): boolean {
  if (!left) return false

  return left.query === right.query
    && left.sourceGithubUsername === right.sourceGithubUsername
    && left.days === right.days
    && arraysEqual(left.languages, right.languages)
    && arraysEqual(left.maturity, right.maturity)
}

function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false

  return left.every((item) => right.includes(item))
}

function mergeSelectedSource(sources: string[], selectedSource: string | null) {
  if (!selectedSource || sources.includes(selectedSource)) {
    return sources
  }

  return [selectedSource, ...sources]
}

// 推荐索引状态卡片：显示最后同步时间和未索引项目警告。加载完成前显示占位卡片，避免前后出现/消失的跳动感
function VectorIndexStatusCard({ vectorStatus, loaded }: { vectorStatus: VectorIndexStatus; loaded: boolean }) {
  if (!loaded) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">数据库状态</span>
        </div>
        <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">加载中...</p>
      </div>
    )
  }

  const hasUnprofiled = vectorStatus.unprofiledCount > 0
  const hasUnindexed = vectorStatus.unindexedCount > 0
  const allReady = !hasUnprofiled && !hasUnindexed

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">数据库状态</span>
        {vectorStatus.totalCount > 0 && vectorStatus.lastSyncAt ? (
          <span className="text-sm text-slate-500 dark:text-slate-400">
            最后更新：{new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(vectorStatus.lastSyncAt))}
          </span>
        ) : null}
      </div>
      {vectorStatus.totalCount === 0 ? (
        <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">数据库为空，请先采集项目</p>
      ) : allReady ? (
        <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">{vectorStatus.totalCount} 个项目全部就绪</p>
      ) : (
        <div className="mt-1 space-y-0.5">
          {hasUnprofiled ? (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              缺少简介：{vectorStatus.unprofiledCount} 个
            </p>
          ) : null}
          {hasUnindexed ? (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              缺少向量：{vectorStatus.unindexedCount} 个
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}
