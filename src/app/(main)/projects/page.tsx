// 创建项目库页：客户端组件需要读写 localStorage 和响应表单交互，所以必须在浏览器侧运行
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

// projectPageSize 决定列表切片和分页器的共同基准，改分页大小时只需要改这一处
const projectPageSize = 4
// projectsStorageKey 带版本号 :v1，后续页面状态结构变更时升级版本号，旧 key 的脏数据不会被解析，避免类型不匹配导致白屏
const projectsStorageKey = 'insight-radar-projects-page-state:v1'

// ProjectsPageState 描述这个页面需要长期保留的状态，刷新页面后会从 localStorage 恢复
interface ProjectsPageState {
  latestJob: CollectionJob
  currentPage: number
  progress: CollectionProgress | null
  snapshot: ProjectsPageSnapshot
}

// initialCollectionJob 给任务卡片提供稳定的空状态，避免页面首次打开时出现缺字段
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

// initialProjectsPageState 是整个页面状态树的默认值，会作为 useBrowserStorage 的兜底数据
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

// ProjectsPage 是项目库创建页的主组件，负责串联表单输入、采集进度、任务卡片和结果分页
export default function ProjectsPage() {
  // 页面状态（页码、进度、快照），通过 useBrowserStorage 持久化到 localStorage
  const [pageState, setPageState] = useBrowserStorage(projectsStorageKey, initialProjectsPageState)
  // 采集表单的草稿状态（GitHub 用户名、天数、最大项目数），从 transient-form-state 恢复
  const [projectDraft, setProjectDraft] = useState(() => readTransientFormState().projects)
  // 从页面状态中提取项目列表
  const projects = pageState.snapshot.items
  // 根据项目总数和每页数量计算总页数，最小为 1
  const totalPages = Math.max(1, Math.ceil(projects.length / projectPageSize))
  // useMemo 避免每次输入表单字符时都重新切片项目数组，只有分页相关状态变化才重算
  const paginatedProjects = useMemo(() => projects.slice((pageState.currentPage - 1) * projectPageSize, pageState.currentPage * projectPageSize), [projects, pageState.currentPage])

  // 更新页面状态（页码、进度、快照），合并到现有状态
  const updatePageState = useCallback((nextState: Partial<ProjectsPageState>) => {
    setPageState((currentState) => ({ ...currentState, ...nextState }))
  }, [setPageState])

  // handleProjectsCollected 是表单采集成功后的出口，把返回的项目列表保存成页面快照
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

  // handleProgressChange 把底层采集进度转换成页面上两个展示区域都能使用的状态
  function handleProgressChange(nextProgress: CollectionProgress) {
    setPageState((currentState) => {
      let nextLatestJob = currentState.latestJob

      // running 分支表示采集还在进行中，需要把当前进度同步到任务卡片
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

      // success 分支表示采集流程已结束，需要固定最终统计并记录完成时间
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

      // failed 分支保留失败信息，让任务卡片能告诉用户失败原因
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

      // 最后一次性写回任务快照和原始进度，避免两个展示组件看到不一致的状态
      return { ...currentState, latestJob: nextLatestJob, progress: nextProgress }
    })
  }

  return (
    <main className="space-y-6">
      {/* 第一区域负责收集输入，用户在这里触发 GitHub Star 项目采集 */}
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
              // 表单输入先写入临时存储，用户切到别的页面再回来时仍能保留草稿
              writeTransientProjectFormState({ githubUsername })
              setProjectDraft((current) => ({ ...current, githubUsername }))
            }}
            onDaysChange={(days) => {
              // 天数变化会影响采集时间范围，也要同步到草稿状态
              writeTransientProjectFormState({ days })
              setProjectDraft((current) => ({ ...current, days }))
            }}
            onMaxProjectsChange={(maxProjects) => {
              // 最大项目数变化会影响本次采集上限，也要同步到草稿状态
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

      {/* 第二区域展示最近一次采集任务的汇总状态 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">采集任务</h2>
        </div>
        <CollectionJobStatusCard job={pageState.latestJob} />
      </section>

      {/* 第三区域展示采集结果，并根据项目数量决定是否显示空状态和分页 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">采集项目</h2>
        </div>
        {projects.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
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

// CollectionProgressCard 专门展示采集过程中的实时提示，pending 或无进度时不占页面空间
function CollectionProgressCard({ progress }: { progress: CollectionProgress | null }) {
  if (!progress || progress.status === 'pending') {
    // 没有开始采集时不渲染进度卡，页面只保留表单和任务汇总
    return null
  }

  // 标题根据采集状态变化，running 时优先带上当前正在处理的 GitHub 用户名
  const title = progress.status === 'running' && progress.currentUsername
    ? `正在采集 ${progress.currentUsername} 账号标星的项目`
    : progress.status === 'success'
      ? '采集完成'
      : '采集失败'
  // 计数文案需要区分失败、未知总数、已知总数三种场景，避免给用户错误进度感知
  const countText = progress.status === 'failed'
    ? progress.fetchedCount > 0
      ? `本次采集在写入或收尾阶段失败，已处理 ${progress.fetchedCount.toLocaleString('zh-CN')} 个项目`
      : '采集开始前即失败'
    : progress.estimatedTotalCount === null
      ? `已采集 ${progress.fetchedCount.toLocaleString('zh-CN')} 个项目`
      : `已采集 ${progress.fetchedCount.toLocaleString('zh-CN')} / ${progress.estimatedTotalCount.toLocaleString('zh-CN')} 个项目`

  return (
    <div className="rounded-2xl border border-brand-ring bg-brand-soft p-5 text-sm text-brand-text dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
      <p className="font-medium">{title}</p>
      <p className="mt-2">{countText}</p>
      {progress.errorMessage ? <p className="mt-2 text-red-600 dark:text-red-300">{progress.errorMessage}</p> : null}
    </div>
  )
}
