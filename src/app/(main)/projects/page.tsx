'use client'

import { useCallback, useMemo, useState } from 'react'
import { CollectionJobStatusCard } from '@/components/projects/collection-job-status-card'
import { GithubUsernameForm } from '@/components/projects/github-username-form'
import { ProjectCard } from '@/components/projects/project-card'
import { ProjectPagination } from '@/components/projects/project-pagination'
import { EmptyState } from '@/components/shared/empty-state'
import { useBrowserStorage } from '@/lib/browser-storage'
import { readTransientFormState, writeTransientProjectFormState } from '@/lib/transient-form-state'
import type { CollectionJob, CollectionProgress, GithubProject, ProjectsPageSnapshot } from '@/types/insight-radar'

// 每页显示的项目卡片数量
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
  const projects = pageState.snapshot.items
  const totalPages = Math.max(1, Math.ceil(projects.length / projectPageSize))
  const paginatedProjects = useMemo(() => projects.slice((pageState.currentPage - 1) * projectPageSize, pageState.currentPage * projectPageSize), [projects, pageState.currentPage])

  // 🔰 更新页面状态（页码、进度、快照），合并到现有状态
  const updatePageState = useCallback((nextState: Partial<ProjectsPageState>) => {
    setPageState((currentState) => ({ ...currentState, ...nextState }))
  }, [setPageState])

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
        {projects.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {paginatedProjects.map((project) => <ProjectCard key={project.repositoryId} project={project} />)}
          </div>
        ) : (
          <EmptyState message="输入 GitHub 账号并点击开始采集后，这里会显示本次采集到的 Star 项目。" />
        )}
        <CollectionProgressCard progress={pageState.progress} />
        {projects.length > projectPageSize ? (
          <ProjectPagination currentPage={pageState.currentPage} totalPages={totalPages} totalItems={projects.length} onPageChange={(currentPage) => updatePageState({ currentPage })} />
        ) : null}
      </section>
    </main>
  )
}

// 🔰 采集进度卡片，根据 progress.status 显示「正在采集」「采集完成」或「采集失败」
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
