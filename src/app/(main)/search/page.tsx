// 项目搜索页：客户端组件，支持关键词和多条件筛选搜索项目库，带分页展示结果
'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ProjectCard } from '@/components/projects/project-card'
import { ProjectPagination } from '@/components/projects/project-pagination'
import { ProjectSearchBar } from '@/components/search/project-search-bar'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorMessage } from '@/components/shared/error-message'
import { LoadingMessage } from '@/components/shared/loading-message'
import { readTransientFormState, writeTransientSearchFormState } from '@/lib/transient-form-state'
import type { GithubProject, ProjectSearchFilters, SearchProjectsResponse } from '@/types/insight-radar'

// projectPageSize 是搜索结果分页的统一页大小，列表请求和分页组件都依赖它
const projectPageSize = 4

// emptyFilters 是搜索页的默认筛选条件，搜索表单和初始请求都会从这里开始
const emptyFilters: ProjectSearchFilters = {
  query: '',
  languages: [],
  maturity: [],
  sourceGithubUsername: null,
  days: null,
}

// SearchPage 是项目搜索页入口，给 useSearchParams 所在组件提供 Suspense 边界
export default function SearchPage() {
  return (
    <Suspense fallback={<LoadingMessage message="正在读取搜索条件" />}>
      <SearchPageContent />
    </Suspense>
  )
}

function SearchPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const skipUrlSyncRef = useRef<string | null>(null)
  const initialFilters = readInitialSearchFilters(searchParams)
  const initialUrlFilters = readFiltersFromSearchParams(searchParams)
  const searchDraft = readTransientFormState().search
  const [draftFilters, setDraftFilters] = useState<ProjectSearchFilters>(() => initialFilters)
  const [filters, setFilters] = useState<ProjectSearchFilters>(() => initialUrlFilters)
  const [currentPage, setCurrentPage] = useState(() => readPageFromSearchParams(searchParams))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sources, setSources] = useState<string[]>(() => mergeSelectedSource(searchDraft.sources, initialFilters.sourceGithubUsername))
  const [sourcesLoaded, setSourcesLoaded] = useState(searchDraft.sourcesLoaded)
  const [projects, setProjects] = useState<GithubProject[]>([])
  const [totalCount, setTotalCount] = useState(0)

  // totalPages 根据后端返回的总数计算，至少为 1，避免分页组件拿到 0 页
  const totalPages = Math.max(1, Math.ceil(totalCount / projectPageSize))

  // 更新搜索表单的草稿筛选条件，不触发搜索；写入临时状态后，切到其他页面再回来仍能恢复未提交输入
  function updateDraftFilters(nextFilters: Partial<ProjectSearchFilters>) {
    setDraftFilters((prev) => {
      const resolvedFilters = { ...prev, ...nextFilters }
      const nextSources = mergeSelectedSource(sources, resolvedFilters.sourceGithubUsername)
      setSources(nextSources)
      writeTransientSearchFormState({ draftFilters: resolvedFilters, sources: nextSources })
      return resolvedFilters
    })
  }

  // fetchProjects 是搜索页统一的请求入口，分页请求和来源下拉框加载都复用它
  const fetchProjects = useCallback(async (nextFilters: ProjectSearchFilters, page: number) => {
    const response = await fetch('/api/projects/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters: nextFilters, page, pageSize: projectPageSize }),
    })
    const result = await response.json() as SearchProjectsResponse

    return { response, result }
  }, [])

  // ensureSourcesLoaded 只在第一次聚焦来源输入框时请求一次，避免重复拉取来源列表
  const ensureSourcesLoaded = useCallback(async () => {
    // 已加载过的直接返回，防止重复触发接口请求
    if (sourcesLoaded) return
    try {
      const { response, result } = await fetchProjects(emptyFilters, 1)
      // API 失败时也标记已加载，避免每次聚焦都重试失败的请求
      if (!response.ok || result.error) {
        setSourcesLoaded(true)
        writeTransientSearchFormState({ sourcesLoaded: true })
        return
      }
      const nextSources = mergeSelectedSource(result.sources, draftFilters.sourceGithubUsername)
      setSources(nextSources)
      setSourcesLoaded(true)
      writeTransientSearchFormState({ sources: nextSources, sourcesLoaded: true })
    } catch {
      // 网络异常同样标记已加载，不阻断用户继续使用其他搜索功能
      setSourcesLoaded(true)
      writeTransientSearchFormState({ sourcesLoaded: true })
    }
  }, [draftFilters.sourceGithubUsername, fetchProjects, sourcesLoaded])

  // runSearch 是搜索页的主流程：提交筛选条件、请求分页数据、同步错误和结果状态
  const runSearch = useCallback(async (nextFilters: ProjectSearchFilters, page = 1) => {
    setLoading(true)
    setError(null)
    setFilters(nextFilters)
    setCurrentPage(page)

    try {
      const { response, result } = await fetchProjects(nextFilters, page)

      // 请求失败时清空旧结果，避免用户误以为旧项目就是本次搜索结果
      if (!response.ok || result.error) {
        const nextSources = mergeSelectedSource(result.sources, nextFilters.sourceGithubUsername)
        setSources(nextSources)
        writeTransientSearchFormState({ sources: nextSources })
        setProjects([])
        setTotalCount(0)
        setError(result.error || '项目搜索失败，请稍后重试。')
        return
      }

      const nextSources = mergeSelectedSource(result.sources, nextFilters.sourceGithubUsername)
      setSources(nextSources)
      writeTransientSearchFormState({ sources: nextSources })
      setProjects(result.projects)
      setTotalCount(result.totalCount)
    } catch {
      // 网络异常时清空结果并提示，不让用户看到过期数据
      setProjects([])
      setTotalCount(0)
      setError('项目搜索失败，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }, [fetchProjects])

  const handleSearch = useCallback(async (page = 1, nextFilters = draftFilters) => {
    const params = buildSearchParams(nextFilters, page)
    skipUrlSyncRef.current = params.toString()
    router.push(`/search${params.toString() ? `?${params.toString()}` : ''}`)
    await runSearch(nextFilters, page)
  }, [draftFilters, router, runSearch])

  useEffect(() => {
    const currentSearch = searchParams.toString()
    if (skipUrlSyncRef.current === currentSearch) {
      skipUrlSyncRef.current = null
      return
    }

    let cancelled = false
    const urlFilters = readFiltersFromSearchParams(searchParams)
    const nextFilters = readInitialSearchFilters(searchParams)
    const nextPage = readPageFromSearchParams(searchParams)

    void Promise.resolve().then(() => {
      if (cancelled) {
        return
      }

      setDraftFilters(nextFilters)
      if (hasSearchParams(urlFilters, nextPage)) {
        void runSearch(nextFilters, nextPage)
        return
      }

      setFilters(urlFilters)
      setCurrentPage(nextPage)
      setError(null)
      setProjects([])
      setTotalCount(0)
    })

    return () => {
      cancelled = true
    }
  }, [runSearch, searchParams])

  return (
    <main className="space-y-6">
      {/* 搜索表单区域只维护草稿条件，点击搜索后才正式请求接口 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">项目搜索</h2>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <ProjectSearchBar filters={draftFilters} sources={sources} loading={loading} onChange={updateDraftFilters} onSearch={() => handleSearch(1, draftFilters)} onSourceInputFocus={ensureSourcesLoaded} />
        </div>
      </section>

      {/* 搜索结果区域按错误、加载、成功、空状态四种路径渲染 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">搜索结果</h2>
        </div>
        {error ? <ErrorMessage message={error} /> : null}
        {loading ? (
          <LoadingMessage message="正在从项目库中搜索项目" />
        ) : projects.length > 0 ? (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              {projects.map((project) => <ProjectCard key={project.repositoryId} project={project} />)}
            </div>
            {totalCount > projectPageSize ? (
              <ProjectPagination currentPage={currentPage} totalPages={totalPages} totalItems={totalCount} onPageChange={(nextPage) => handleSearch(nextPage, filters)} />
            ) : null}
          </>
        ) : (
          <EmptyState message={error ? '搜索失败。请调整条件或稍后重试。' : '请输入关键词或来源账号，从项目库中搜索已采集项目。'} />
        )}
      </section>
    </main>
  )
}

function buildSearchParams(filters: ProjectSearchFilters, page: number) {
  const params = new URLSearchParams()

  if (filters.query.trim()) params.set('q', filters.query.trim())
  if (filters.languages[0]) params.set('language', filters.languages[0])
  if (filters.maturity[0]) params.set('maturity', filters.maturity[0])
  if (filters.sourceGithubUsername) params.set('source', filters.sourceGithubUsername)
  if (filters.days) params.set('days', String(filters.days))
  if (page > 1) params.set('page', String(page))

  return params
}

function hasSearchParams(filters: ProjectSearchFilters, page: number) {
  return Boolean(filters.query || filters.languages.length || filters.maturity.length || filters.sourceGithubUsername || filters.days || page > 1)
}

function readInitialSearchFilters(searchParams: ReturnType<typeof useSearchParams>) {
  const urlFilters = readFiltersFromSearchParams(searchParams)
  const urlPage = readPageFromSearchParams(searchParams)

  if (hasSearchParams(urlFilters, urlPage)) {
    return urlFilters
  }

  return readTransientFormState().search.draftFilters
}

function mergeSelectedSource(sources: string[], selectedSource: string | null) {
  if (!selectedSource || sources.includes(selectedSource)) {
    return sources
  }

  return [selectedSource, ...sources]
}

function readFiltersFromSearchParams(searchParams: ReturnType<typeof useSearchParams>) {
  const query = searchParams.get('q') ?? ''
  const language = searchParams.get('language') ?? ''
  const maturity = searchParams.get('maturity') ?? ''
  const sourceGithubUsername = searchParams.get('source')
  const daysValue = searchParams.get('days')
  const days = daysValue ? Number(daysValue) : null

  return {
    query,
    languages: language ? [language] : [],
    maturity: maturity ? [maturity as ProjectSearchFilters['maturity'][number]] : [],
    sourceGithubUsername,
    days: Number.isFinite(days) ? days : null,
  }
}

function readPageFromSearchParams(searchParams: ReturnType<typeof useSearchParams>) {
  const pageValue = Number(searchParams.get('page') ?? '1')
  return Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1
}
