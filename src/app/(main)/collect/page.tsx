'use client'

import { AppShell } from '@/components/app/app-shell'
import { SectionCard } from '@/components/app/section-card'
import { CollectionJobStatusCard } from '@/components/collect/collection-job-status-card'
import { ProjectCard } from '@/components/projects/project-card'
import { mockCollectionJobs, mockProjects } from '@/data/mock-insight-radar'

export default function CollectPage() {
  const latestJob = mockCollectionJobs[0]

  return (
    <AppShell currentPath="/collect">
      <main className="space-y-6">
        <SectionCard title="采集入口已合并到首页" description="请在首页输入 GitHub 用户名开始采集，这里保留最近采集状态和采集结果回顾。">
          <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">首页会创建新的采集任务，并把来源账号、采集时间和来源链接沉淀到项目库。</p>
        </SectionCard>

        <CollectionJobStatusCard job={latestJob} />

        <SectionCard title="本次采集项目列表" description="每个项目都展示来源账号、关注时间和来源链接。">
          <div className="grid gap-4 lg:grid-cols-2">
            {mockProjects.slice(0, 3).map((project) => <ProjectCard key={project.repositoryId} project={project} />)}
          </div>
        </SectionCard>
      </main>
    </AppShell>
  )
}
