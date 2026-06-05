'use client'

import { useMemo, useState } from 'react'
import { AppShell } from '@/components/app/app-shell'
import { CollectionJobStatusCard } from '@/components/collect/collection-job-status-card'
import { GithubUsernameForm } from '@/components/collect/github-username-form'
import { ProjectCard } from '@/components/projects/project-card'
import { ProjectPagination } from '@/components/projects/project-pagination'
import { mockCollectionJobs } from '@/data/mock-insight-radar'
import { readBrowserStorage, useBrowserStorage } from '@/lib/browser-storage'
import { readTransientFormState, writeTransientProjectFormState } from '@/lib/transient-form-state'
import type { CollectionJob, CollectionProgress, GithubProject } from '@/types/insight-radar'

const projectPageSize = 4
const projectsStorageKey = 'insight-radar-projects-page-state'

interface ProjectsPageState {
  latestJob: CollectionJob
  projects: GithubProject[]
  currentPage: number
  progress: CollectionProgress | null
}

const initialProjectsPageState: ProjectsPageState = {
  latestJob: mockCollectionJobs[0],
  projects: [],
  currentPage: 1,
  progress: null,
}

export default function ProjectsPage() {
  const [pageState, setPageState] = useBrowserStorage(projectsStorageKey, initialProjectsPageState)
  const [projectDraft, setProjectDraft] = useState(() => readTransientFormState().projects)
  const totalPages = Math.max(1, Math.ceil(pageState.projects.length / projectPageSize))
  const paginatedProjects = useMemo(() => pageState.projects.slice((pageState.currentPage - 1) * projectPageSize, pageState.currentPage * projectPageSize), [pageState.projects, pageState.currentPage])

  function updatePageState(nextState: Partial<ProjectsPageState>) {
    const currentState = readBrowserStorage(projectsStorageKey, pageState)
    setPageState({ ...currentState, ...nextState })
  }

  function handleProjectsCollected(nextProjects: GithubProject[]) {
    updatePageState({ projects: nextProjects, currentPage: 1 })
  }

  function handleProgressChange(nextProgress: CollectionProgress) {
    const currentState = readBrowserStorage(projectsStorageKey, pageState)
    let nextLatestJob = currentState.latestJob

    if (nextProgress.status === 'running') {
      const duplicateCount = nextProgress.duplicateCount ?? 0

      nextLatestJob = {
        ...currentState.latestJob,
        githubUsername: nextProgress.currentUsername ?? currentState.latestJob.githubUsername,
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
        ...currentState.latestJob,
        githubUsername: nextProgress.currentUsername ?? currentState.latestJob.githubUsername,
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
        ...currentState.latestJob,
        githubUsername: nextProgress.currentUsername ?? currentState.latestJob.githubUsername,
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
          </div>
          {pageState.projects.length > 0 ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {paginatedProjects.map((project) => <ProjectCard key={project.repositoryId} project={project} />)}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
              输入 GitHub 账号并点击开始采集后，这里会显示本次采集到的 Star 项目。
            </div>
          )}
          {pageState.projects.length > projectPageSize ? (
            <ProjectPagination currentPage={pageState.currentPage} totalPages={totalPages} totalItems={pageState.projects.length} onPageChange={(currentPage) => updatePageState({ currentPage })} />
          ) : null}
        </section>
        <CollectionProgressCard progress={pageState.progress} />
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
  const countText = progress.estimatedTotalCount === null
    ? `已获取 ${progress.fetchedCount.toLocaleString('zh-CN')} 个项目`
    : `已获取 ${progress.fetchedCount.toLocaleString('zh-CN')} / ${progress.estimatedTotalCount.toLocaleString('zh-CN')} 个项目`

  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
      <p className="font-medium">{title}</p>
      <p className="mt-2">{countText}</p>
      {progress.errorMessage ? <p className="mt-2 text-red-600 dark:text-red-300">{progress.errorMessage}</p> : null}
    </div>
  )
}
