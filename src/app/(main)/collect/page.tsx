import { AppShell } from '@/components/app/app-shell'
import { SectionCard } from '@/components/app/section-card'
import { CollectionJobStatusCard } from '@/components/collect/collection-job-status-card'
import { ProjectCard } from '@/components/projects/project-card'
import { getLatestProjects } from '@/lib/projects-repository'
import type { CollectionJob } from '@/types/insight-radar'

const emptyCollectionJob: CollectionJob = {
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

export default async function CollectPage() {
  const latestProjects = await getLatestProjects(3)

  return (
    <AppShell currentPath="/collect">
      <main className="space-y-6">
        <SectionCard title="采集入口已合并到首页" description="请在首页输入 GitHub 用户名开始采集，这里保留最近采集状态和采集结果回顾。">
          <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">首页会创建新的采集任务，并把来源账号、采集时间和来源链接沉淀到项目库。</p>
        </SectionCard>

        <CollectionJobStatusCard job={emptyCollectionJob} />

        <SectionCard title="最近入库项目" description="展示项目库中最新入库的项目，便于快速回顾最近一次采集结果。">
          {latestProjects.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {latestProjects.map((project) => <ProjectCard key={project.repositoryId} project={project} />)}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
              项目库暂时为空，请先在首页或项目页采集 GitHub 账号。
            </div>
          )}
        </SectionCard>
      </main>
    </AppShell>
  )
}
