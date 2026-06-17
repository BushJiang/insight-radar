// 🔰 智能推荐页客户端组件：管理推荐表单状态、简介生成轮询、AI 推荐请求，表单状态存模块内存（transient-form-state）
'use client'

import { useCallback, useEffect, useState } from 'react'
import { RecommendationExplanationCard } from '@/components/recommendations/recommendation-explanation-card'
import { RecommendationRequestPanel } from '@/components/recommendations/recommendation-request-panel'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorMessage } from '@/components/shared/error-message'
import { getDefaultPreference, normalizePreference, preferenceStorageKey } from '@/lib/default-preference'
import { readBrowserStorage } from '@/lib/browser-storage'
import { readTransientFormState, writeTransientRecommendationFormState } from '@/lib/transient-form-state'
import type { GithubProject, ProjectProfileProgress, ProjectSearchFilters, RecommendationExplanation, SearchProjectsResponse } from '@/types/insight-radar'

interface RecommendationsPageClientProps {
  initialProjects: GithubProject[]
}

// 🔰 项目简介生成进度的初始值（未开始状态）
const initialProgress: ProjectProfileProgress = {
  status: 'ready',
  completedCount: 0,
  totalCount: 0,
  message: null,
}

export default function RecommendationsPageClient({ initialProjects }: RecommendationsPageClientProps) {
  // 🔰 从 transient-form-state 恢复上次的表单状态，SPA 路由跳转不丢失，但刷新页面后重置为默认值
  const recommendationDraft = readTransientFormState().recommendations
  // 🔰 用户输入的表单状态（推荐数量、筛选条件、需求描述、推荐结果）
  const [recommendationLimit, setRecommendationLimit] = useState(recommendationDraft.recommendationLimit)
  const [filters, setFilters] = useState(recommendationDraft.filters)
  const [query, setQuery] = useState(recommendationDraft.query)
  const [recommendations, setRecommendations] = useState<RecommendationExplanation[]>(recommendationDraft.recommendations)
  const [projects, setProjects] = useState(recommendationDraft.projects.length > 0 ? recommendationDraft.projects : initialProjects)
  // 🔰 来源账号列表，用于筛选下拉框的选项
  const [sources, setSources] = useState<string[]>([])
  const [sourcesLoaded, setSourcesLoaded] = useState(false)
  // 🔰 项目简介生成进度（总数、已完成数、状态）
  const [progress, setProgress] = useState<ProjectProfileProgress>(initialProgress)
  const [loading, setLoading] = useState(false)
  const [recommending, setRecommending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 🔰 还有项目没生成简介时，显示「生成项目简介」按钮
  const canGenerateProfiles = progress.totalCount > progress.completedCount

  // 🔰 进入页面或筛选条件变化时，自动查询项目简介生成进度
  useEffect(() => {
    let cancelled = false
    // 查询项目简介的生成进度
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

  // 🔰 首次点击来源下拉框时，发送空搜索获取所有来源账号列表
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

  // 🔰 点「智能推荐」按钮：调 API 获取 AI 推荐结果
  const handleRecommend = useCallback(async () => {
    setLoading(true)
    setRecommending(true)
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
        writeTransientRecommendationFormState({ projects: result.projects })
      }

      if (result.recommendation) {
        setRecommendations([result.recommendation])
        writeTransientRecommendationFormState({ recommendations: [result.recommendation], projects: result.projects })
      }
    } catch {
      setError('智能推荐失败，请稍后重试。')
    } finally {
      setRecommending(false)
      setLoading(false)
    }
  }, [filters, query, recommendationLimit])

  // 🔰 点「生成项目简介」按钮：轮询调用 API，每 500ms 检查一次进度，直到全部完成
  const handleGenerateProfiles = useCallback(async () => {
    setLoading(true)
    setError(null)
    setProgress({ status: 'running', completedCount: 0, totalCount: 1, message: '正在准备生成项目简介' })

    try {
      let stableProgress = initialProgress

      while (true) {
        const result = await requestProjectProfiles('generate', filters, [])
        stableProgress = resolveStableProgress(stableProgress, result.progress)

        setProgress(stableProgress)
        if (result.error) {
          setError(result.error)
          return
        }

        if (result.progress.status !== 'running') {
          return
        }
        // 🔰 轮询间延迟 500ms，避免空转浪费服务器资源
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    } catch {
      setError('生成过程中网络异常，已生成的项目简介已保存。可重新点击按钮继续。')
    } finally {
      setLoading(false)
    }
  }, [filters])

  // 🔰 点「重新生成项目简介」按钮：和生成类似，但会重新生成已有简介的项目
  const handleRegenerateProfiles = useCallback(async () => {
    setLoading(true)
    setError(null)
    // 🔰 立即显示进度条，避免 AI 生成期间（10-30s）UI 无反馈
    setProgress({ status: 'running', completedCount: 0, totalCount: 1, message: '正在准备重新生成项目简介' })

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

        if (result.progress.status === 'ready') {
          setProgress(result.progress)
          // 🔰 API 在再生完成时直接返回最新项目数据，无需额外请求
          if (result.projects.length > 0) {
            setProjects(result.projects)
            writeTransientRecommendationFormState({ projects: result.projects })
          }
          return
        }

        if (result.progress.status !== 'running') {
          return
        }
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    } catch {
      setError('重新生成过程中网络异常，已生成的项目简介已保存。可重新点击按钮继续。')
    } finally {
      setLoading(false)
    }
  }, [filters])

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
        setError(result.error || '清空数据失败，请稍后重试。')
        return
      }

      setProjects([])
      setRecommendations([])
      setSources([])
      setSourcesLoaded(false)
      setProgress(initialProgress)
      writeTransientRecommendationFormState({ projects: [], recommendations: [] })
    } catch {
      setError('清空数据失败，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }, [])

  return (
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
          recommending={recommending}
          profileRunning={loading && !recommending}
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
          onClearData={() => void handleClearData()}
        />
        <ProjectProfileProgressCard progress={progress} />
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

// 🔰 调用 /api/project-profiles 接口。action='status' 查询进度，'generate' 生成简介，'regenerate' 重新生成
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
  const result = await response.json() as { progress: ProjectProfileProgress; processedRepositoryIds: string[]; projects: GithubProject[]; error: string | null }

  if (!response.ok && !result.error) {
    return { ...result, error: '项目简介生成失败，请稍后重试。' }
  }

  return result
}

// 🔰 合并轮询中两次返回的进度数据。AI 生成是分批的，每次只返回新完成的，需要累加到上一次进度上
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

// 🔰 项目简介生成进度条组件。显示完成数/总数 + 百分比进度条。全部完成时自动隐藏
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
        <div className="h-full rounded-full bg-brand-primary transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
