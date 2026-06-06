'use client'

import { useCallback, useMemo, useState } from 'react'
import { AppShell } from '@/components/app/app-shell'
import { CollectionJobStatusCard } from '@/components/collect/collection-job-status-card'
import { GithubUsernameForm } from '@/components/collect/github-username-form'
import { ProjectCard } from '@/components/projects/project-card'
import { ProjectPagination } from '@/components/projects/project-pagination'
import { useBrowserStorage } from '@/lib/browser-storage'
import { readTransientFormState, writeTransientProjectFormState } from '@/lib/transient-form-state'
import type { CollectionJob, CollectionProgress, GithubProject, ProjectsPageSnapshot, SearchProjectsResponse } from '@/types/insight-radar'

const projectPageSize = 4
const projectsStorageKey = 'insight-radar-projects-page-state'

interface ProjectsPageState {
  latestJob: CollectionJob
  currentPage: number
  progress: CollectionProgress | null
  snapshot: ProjectsPageSnapshot
}

const initialCollectionJob: CollectionJob = {
  id: 'collection-job-empty',
  githubUsername: '暂无',
  status: 'pending',
  startedAt: null,
  finishedAt: null,
  createdProjectCount: 0,
  duplicateProjectCount: 0,
  updatedProjectCount: 0,
  failedCount: 0,
  errorMessage: null,
  rateLimitResetAt: null,
}

const initialProjectsPageState: ProjectsPageState = {
  latestJob: initialCollectionJob,
  currentPage: 1,
  progress: null,
  snapshot: {
    items: [],
    sourceGithubUsername: null,
    updatedAt: null,
  },
}

export default function ProjectsPage() {
  const [pageState, setPageState] = useBrowserStorage(projectsStorageKey, initialProjectsPageState)
  const [projectDraft, setProjectDraft] = useState(() => readTransientFormState().projects)
  const [isRestoring, setIsRestoring] = useState(false)
  const projects = pageState.snapshot.items
  const totalPages = Math.max(1, Math.ceil(projects.length / projectPageSize))
  const paginatedProjects = useMemo(() => projects.slice((pageState.currentPage - 1) * projectPageSize, pageState.currentPage * projectPageSize), [projects, pageState.currentPage])

  const updatePageState = useCallback((nextState: Partial<ProjectsPageState>) => {
    setPageState((currentState) => ({ ...currentState, ...nextState }))
  }, [setPageState])

  const restoreProjects = useCallback(async () => {
    const sourceGithubUsername = pageState.snapshot.sourceGithubUsername ?? (projectDraft.githubUsername.trim() || null)

    if (!sourceGithubUsername || pageState.snapshot.items.length > 0) {
      return
    }

    setIsRestoring(true)

    try {
      const response = await fetch('/api/projects/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: {
            query: '',
            languages: [],
            maturity: [],
            sourceGithubUsername,
            days: projectDraft.days === 'all' ? null : Number(projectDraft.days),
          },
          page: 1,
          pageSize: Number(projectDraft.maxProjects) > 0 ? Number(projectDraft.maxProjects) : 100,
        }),
      })
      const result = await response.json() as SearchProjectsResponse

      if (!response.ok || result.error) {
        return
      }

      updatePageState({
        snapshot: {
          items: result.projects,
          sourceGithubUsername,
          updatedAt: new Date().toISOString(),
        },
      })
    } finally {
      setIsRestoring(false)
    }
  }, [pageState.snapshot.items.length, pageState.snapshot.sourceGithubUsername, projectDraft.days, projectDraft.githubUsername, projectDraft.maxProjects, updatePageState])

  function handleProjectsCollected(nextProjects: GithubProject[]) {
    updatePageState({
      currentPage: 1,
      snapshot: {
        items: nextProjects,
        sourceGithubUsername: projectDraft.githubUsername.trim() || null,
        updatedAt: new Date().toISOString(),
      },
    })
  }

  function handleProgressChange(nextProgress: CollectionProgress) {
    let nextLatestJob = pageState.latestJob

    if (nextProgress.status === 'running') {
      const duplicateCount = nextProgress.duplicateCount ?? 0

      nextLatestJob = {
        ...pageState.latestJob,
        githubUsername: nextProgress.currentUsername ?? pageState.latestJob.githubUsername,
        status: 'running',
        startedAt: nextProgress.startedAt,
        finishedAt: null,
        createdProjectCount: nextProgress.fetchedCount - duplicateCount,
        duplicateProjectCount: duplicateCount,
        failedCount: 0,
        errorMessage: null,
      }
    }

    if (nextProgress.status === 'success') {
      const duplicateCount = nextProgress.duplicateCount ?? 0

      nextLatestJob = {
        ...pageState.latestJob,
        githubUsername: nextProgress.currentUsername ?? pageState.latestJob.githubUsername,
        status: 'success',
        finishedAt: nextProgress.finishedAt,
        createdProjectCount: nextProgress.fetchedCount - duplicateCount,
        duplicateProjectCount: duplicateCount,
        failedCount: 0,
        errorMessage: null,
      }
    }

    if (nextProgress.status === 'failed') {
      nextLatestJob = {
        ...pageState.latestJob,
        githubUsername: nextProgress.currentUsername ?? pageState.latestJob.githubUsername,
        status: 'failed',
        finishedAt: nextProgress.finishedAt,
        failedCount: 1,
        errorMessage: nextProgress.errorMessage,
      }
    }

    updatePageState({ latestJob: nextLatestJob, progress: nextProgress })
  }

  return (
    <AppShell currentPath="/projects">
      <main className="space-y-6">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">创建项目库</h2>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <GithubUsernameForm
              githubUsername={projectDraft.githubUsername}
              days={projectDraft.days}
              maxProjects={projectDraft.maxProjects}
              onGithubUsernameChange={(githubUsername) => {
                writeTransientProjectFormState({ githubUsername })
                setProjectDraft((current) => ({ ...current, githubUsername }))
              }}
              onDaysChange={(days) => {
                writeTransientProjectFormState({ days })
                setProjectDraft((current) => ({ ...current, days }))
              }}
              onMaxProjectsChange={(maxProjects) => {
                writeTransientProjectFormState({ maxProjects })
                setProjectDraft((current) => ({ ...current, maxProjects }))
              }}
              multiple
              inline
              onProjectsCollected={handleProjectsCollected}
              onProgressChange={handleProgressChange}
            />
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">采集任务</h2>
          </div>
          <CollectionJobStatusCard job={pageState.latestJob} />
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">采集项目</h2>
            {!isRestoring && projects.length === 0 && pageState.snapshot.sourceGithubUsername ? (
              <button type="button" onClick={() => void restoreProjects()} className="text-sm font-medium text-emerald-700 transition hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200">
                恢复上次采集结果
              </button>
            ) : null}
          </div>
          {isRestoring ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              正在恢复上次采集的项目
            </div>
          ) : projects.length > 0 ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {paginatedProjects.map((project) => <ProjectCard key={project.repositoryId} project={project} />)}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
              输入 GitHub 账号并点击开始采集后，这里会显示本次采集到的 Star 项目。
            </div>
          )}
          <CollectionProgressCard progress={pageState.progress} />
          {projects.length > projectPageSize ? (
            <ProjectPagination currentPage={pageState.currentPage} totalPages={totalPages} totalItems={projects.length} onPageChange={(currentPage) => updatePageState({ currentPage })} />
          ) : null}
        </section>
      </main>
    </AppShell>
  )
}

function CollectionProgressCard({ progress }: { progress: CollectionProgress | null }) {
  if (!progress || progress.status === 'pending') {
    return null
  }

  const title = progress.status === 'running' && progress.currentUsername
    ? `正在采集 ${progress.currentUsername} 账号标星的项目`
    : progress.status === 'success'
      ? '采集完成'
      : '采集失败'
  const countText = progress.status === 'failed'
    ? progress.fetchedCount > 0
      ? `本次采集在写入或收尾阶段失败，已处理 ${progress.fetchedCount.toLocaleString('zh-CN')} 个项目`
      : '采集开始前即失败'
    : progress.estimatedTotalCount === null
      ? `已采集 ${progress.fetchedCount.toLocaleString('zh-CN')} 个项目`
      : `已采集 ${progress.fetchedCount.toLocaleString('zh-CN')} / ${progress.estimatedTotalCount.toLocaleString('zh-CN')} 个项目`

  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
      <p className="font-medium">{title}</p>
      <p className="mt-2">{countText}</p>
      {progress.errorMessage ? <p className="mt-2 text-red-600 dark:text-red-300">{progress.errorMessage}</p> : null}
    </div>
  )
}
