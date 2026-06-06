'use client'

import { useCallback, useState } from 'react'
import { AppShell } from '@/components/app/app-shell'
import { ProjectCard } from '@/components/projects/project-card'
import { ProjectPagination } from '@/components/projects/project-pagination'
import { ProjectSearchBar } from '@/components/projects/project-search-bar'
import { useBrowserStorage } from '@/lib/browser-storage'
import type { ProjectSearchFilters, SearchPageSnapshot, SearchProjectsResponse } from '@/types/insight-radar'

const projectPageSize = 4
const searchStorageKey = 'insight-radar-search-page-state'

const initialFilters: ProjectSearchFilters = {
  query: '',
  languages: [],
  maturity: [],
  sourceGithubUsername: null,
  days: null,
}

interface SearchPageState {
  draftFilters: ProjectSearchFilters
  filters: ProjectSearchFilters
  currentPage: number
  totalCount: number
  snapshot: SearchPageSnapshot
}

const initialSearchPageState: SearchPageState = {
  draftFilters: initialFilters,
  filters: initialFilters,
  currentPage: 1,
  totalCount: 0,
  snapshot: {
    items: [],
    updatedAt: null,
  },
}

export default function SearchPage() {
  const [pageState, setPageState] = useBrowserStorage(searchStorageKey, initialSearchPageState)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sources, setSources] = useState<string[]>([])
  const [sourcesLoaded, setSourcesLoaded] = useState(false)
  const projects = pageState.snapshot.items
  const totalPages = Math.max(1, Math.ceil(pageState.totalCount / projectPageSize))

  const updatePageState = useCallback((nextState: Partial<SearchPageState>) => {
    setPageState((currentState) => ({ ...currentState, ...nextState }))
  }, [setPageState])

  function updateDraftFilters(nextFilters: Partial<ProjectSearchFilters>) {
    updatePageState({ draftFilters: { ...pageState.draftFilters, ...nextFilters } })
  }

  async function fetchProjects(filters: ProjectSearchFilters, page: number) {
    const response = await fetch('/api/projects/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters,
        page,
        pageSize: projectPageSize,
      }),
    })
    const result = await response.json() as SearchProjectsResponse

    return { response, result }
  }

  async function ensureSourcesLoaded() {
    if (sourcesLoaded) {
      return
    }

    try {
      const { response, result } = await fetchProjects(initialFilters, 1)

      if (!response.ok || result.error) {
        setSourcesLoaded(true)
        return
      }

      setSources(result.sources)
      setSourcesLoaded(true)
    } catch {
      setSourcesLoaded(true)
    }
  }

  const handleSearch = useCallback(async (page = 1, filters = pageState.draftFilters) => {
    setLoading(true)
    setError(null)
    updatePageState({ filters, currentPage: page })

    try {
      const { response, result } = await fetchProjects(filters, page)

      if (!response.ok || result.error) {
        setSources(result.sources)
        updatePageState({ totalCount: 0, snapshot: { items: [], updatedAt: null } })
        setError(result.error || '项目搜索失败，请稍后重试。')
        return
      }

      setSources(result.sources)
      updatePageState({
        totalCount: result.totalCount,
        snapshot: {
          items: result.projects,
          updatedAt: new Date().toISOString(),
        },
      })
    } catch {
      updatePageState({ totalCount: 0, snapshot: { items: [], updatedAt: null } })
      setError('项目搜索失败，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }, [pageState.draftFilters, updatePageState])

  const hasSearchContext = Boolean(
    pageState.filters.query.trim()
    || pageState.filters.sourceGithubUsername
    || pageState.filters.languages.length > 0
    || pageState.filters.maturity.length > 0
    || pageState.filters.days !== null,
  )

  return (
    <AppShell currentPath="/search">
      <main className="space-y-6">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">项目搜索</h2>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <ProjectSearchBar filters={pageState.draftFilters} sources={sources} loading={loading} onChange={updateDraftFilters} onSearch={() => handleSearch(1, pageState.draftFilters)} onSourceInputFocus={ensureSourcesLoaded} />
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">搜索结果</h2>
            {!loading && projects.length === 0 && hasSearchContext && pageState.totalCount > 0 ? (
              <button type="button" onClick={() => void handleSearch(pageState.currentPage, pageState.filters)} className="text-sm font-medium text-emerald-700 transition hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200">
                恢复搜索结果
              </button>
            ) : null}
          </div>
          <div className="min-h-[58px]">
            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                {error}
              </div>
            ) : null}
          </div>
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              正在从项目库中搜索项目
            </div>
          ) : projects.length > 0 ? (
            <>
              <div className="grid gap-4 xl:grid-cols-2">
                {projects.map((project) => <ProjectCard key={project.repositoryId} project={project} />)}
              </div>
              {pageState.totalCount > projectPageSize ? (
                <ProjectPagination currentPage={pageState.currentPage} totalPages={totalPages} totalItems={pageState.totalCount} onPageChange={(currentPage) => handleSearch(currentPage, pageState.filters)} />
              ) : null}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {error ? '搜索失败。请调整条件或稍后重试。' : '请输入关键词或来源账号，从项目库中搜索已采集项目。'}
            </div>
          )}
        </section>
      </main>
    </AppShell>
  )
}
