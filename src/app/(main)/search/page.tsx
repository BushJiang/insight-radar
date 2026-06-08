'use client'

import { useCallback, useState } from 'react'
import { ProjectCard } from '@/components/projects/project-card'
import { ProjectPagination } from '@/components/projects/project-pagination'
import { ProjectSearchBar } from '@/components/search/project-search-bar'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorMessage } from '@/components/shared/error-message'
import { LoadingMessage } from '@/components/shared/loading-message'
import type { GithubProject, ProjectSearchFilters, SearchProjectsResponse } from '@/types/insight-radar'

const projectPageSize = 4

const emptyFilters: ProjectSearchFilters = {
  query: '',
  languages: [],
  maturity: [],
  sourceGithubUsername: null,
  days: null,
}

export default function SearchPage() {
  const [draftFilters, setDraftFilters] = useState<ProjectSearchFilters>(emptyFilters)
  const [filters, setFilters] = useState<ProjectSearchFilters>(emptyFilters)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sources, setSources] = useState<string[]>([])
  const [sourcesLoaded, setSourcesLoaded] = useState(false)
  const [projects, setProjects] = useState<GithubProject[]>([])
  const [totalCount, setTotalCount] = useState(0)

  const totalPages = Math.max(1, Math.ceil(totalCount / projectPageSize))

  function updateDraftFilters(nextFilters: Partial<ProjectSearchFilters>) {
    setDraftFilters((prev) => ({ ...prev, ...nextFilters }))
  }

  async function fetchProjects(filters: ProjectSearchFilters, page: number) {
    const response = await fetch('/api/projects/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters, page, pageSize: projectPageSize }),
    })
    const result = await response.json() as SearchProjectsResponse

    return { response, result }
  }

  async function ensureSourcesLoaded() {
    if (sourcesLoaded) return
    try {
      const { response, result } = await fetchProjects(emptyFilters, 1)
      if (!response.ok || result.error) { setSourcesLoaded(true); return }
      setSources(result.sources)
      setSourcesLoaded(true)
    } catch {
      setSourcesLoaded(true)
    }
  }

  const handleSearch = useCallback(async (page = 1, filterValues = draftFilters) => {
    setLoading(true)
    setError(null)
    setFilters(filterValues)
    setCurrentPage(page)

    try {
      const { response, result } = await fetchProjects(filterValues, page)

      if (!response.ok || result.error) {
        setSources(result.sources)
        setProjects([])
        setTotalCount(0)
        setError(result.error || '项目搜索失败，请稍后重试。')
        return
      }

      setSources(result.sources)
      setProjects(result.projects)
      setTotalCount(result.totalCount)
    } catch {
      setProjects([])
      setTotalCount(0)
      setError('项目搜索失败，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }, [draftFilters])

  return (
    <main className="space-y-6">
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">项目搜索</h2>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <ProjectSearchBar filters={draftFilters} sources={sources} loading={loading} onChange={updateDraftFilters} onSearch={() => handleSearch(1, draftFilters)} onSourceInputFocus={ensureSourcesLoaded} />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">搜索结果</h2>
        </div>
        {error ? <ErrorMessage message={error} /> : null}
        {loading ? (
          <LoadingMessage message="正在从项目库中搜索项目" />
        ) : projects.length > 0 ? (
          <>
            <div className="grid gap-4 xl:grid-cols-2">
              {projects.map((project) => <ProjectCard key={project.repositoryId} project={project} />)}
            </div>
            {totalCount > projectPageSize ? (
              <ProjectPagination currentPage={currentPage} totalPages={totalPages} totalItems={totalCount} onPageChange={(currentPage) => handleSearch(currentPage, filters)} />
            ) : null}
          </>
        ) : (
          <EmptyState message={error ? '搜索失败。请调整条件或稍后重试。' : '请输入关键词或来源账号，从项目库中搜索已采集项目。'} />
        )}
      </section>
    </main>
  )
}
