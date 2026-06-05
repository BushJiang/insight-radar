'use client'

import { useMemo, useState } from 'react'
import { AppShell } from '@/components/app/app-shell'
import { ProjectCard } from '@/components/projects/project-card'
import { ProjectPagination } from '@/components/projects/project-pagination'
import { ProjectSearchBar } from '@/components/projects/project-search-bar'
import { mockProjects } from '@/data/mock-insight-radar'
import { useBrowserStorage } from '@/lib/browser-storage'
import type { GithubProject, GithubStarredSearchResponse, ProjectSearchFilters } from '@/types/insight-radar'

const projectPageSize = 4
const searchStorageKey = 'insight-radar-search-page-state'

const initialFilters: ProjectSearchFilters = {
  query: '',
  languages: [],
  sourceGithubUsername: null,
  days: null,
}

interface SearchPageState {
  draftFilters: ProjectSearchFilters
  filters: ProjectSearchFilters
  matchedProjects: GithubProject[]
  currentPage: number
  error: string | null
}

const initialSearchPageState: SearchPageState = {
  draftFilters: initialFilters,
  filters: initialFilters,
  matchedProjects: [],
  currentPage: 1,
  error: null,
}

export default function SearchPage() {
  const [pageState, setPageState] = useBrowserStorage(searchStorageKey, initialSearchPageState)
  const [loading, setLoading] = useState(false)
  const sources = Array.from(new Set(mockProjects.map((project) => project.sourceGithubUsername)))
  const totalPages = Math.max(1, Math.ceil(pageState.matchedProjects.length / projectPageSize))
  const projects = useMemo(() => pageState.matchedProjects.slice((pageState.currentPage - 1) * projectPageSize, pageState.currentPage * projectPageSize), [pageState.matchedProjects, pageState.currentPage])

  function updatePageState(nextState: Partial<SearchPageState>) {
    setPageState({ ...pageState, ...nextState })
  }

  function updateDraftFilters(nextFilters: Partial<ProjectSearchFilters>) {
    updatePageState({ draftFilters: { ...pageState.draftFilters, ...nextFilters } })
  }

  async function handleSearch() {
    setLoading(true)
    updatePageState({ error: null, filters: pageState.draftFilters, currentPage: 1 })

    try {
      const response = await fetch('/api/github/starred-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: pageState.draftFilters,
          githubToken: window.localStorage.getItem('insight-radar-github-token') || undefined,
        }),
      })
      const result = await response.json() as GithubStarredSearchResponse

      if (!response.ok || result.error) {
        updatePageState({ matchedProjects: [], error: result.error || '项目搜索失败，请稍后重试。' })
        return
      }

      updatePageState({ matchedProjects: result.projects })
    } catch {
      updatePageState({ matchedProjects: [], error: '项目搜索失败，请检查网络后重试。' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell currentPath="/search">
      <main className="space-y-6">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">项目搜索</h2>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <ProjectSearchBar filters={pageState.draftFilters} sources={sources} loading={loading} onChange={updateDraftFilters} onSearch={handleSearch} />
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">搜索结果</h2>
          </div>
          <div className="min-h-[58px]">
            {pageState.error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                {pageState.error}
              </div>
            ) : null}
          </div>
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              正在从 GitHub 获取来源账号 Star 的项目...
            </div>
          ) : projects.length > 0 ? (
            <>
              <div className="grid gap-4 xl:grid-cols-2">
                {projects.map((project) => <ProjectCard key={project.repositoryId} project={project} />)}
              </div>
              {pageState.matchedProjects.length > projectPageSize ? (
                <ProjectPagination currentPage={pageState.currentPage} totalPages={totalPages} totalItems={pageState.matchedProjects.length} onPageChange={(currentPage) => updatePageState({ currentPage })} />
              ) : null}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {pageState.error ? '搜索失败。请调整条件或稍后重试。' : '请输入来源账号并点击搜索，获取该账号 Star 的项目。'}
            </div>
          )}
        </section>
      </main>
    </AppShell>
  )
}
