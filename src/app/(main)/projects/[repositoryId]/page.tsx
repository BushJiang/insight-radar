// 🔰 项目详情页：服务端组件 + ISR（revalidate=3600），根据 repositoryId 查 DB 展示项目完整信息
import { notFound } from 'next/navigation'
import { getProjectByRepositoryId } from '@/lib/projects-repository'
import { Button } from '@/components/ui/button'
import type { ProjectMaturity } from '@/types/insight-radar'

export const revalidate = 60

interface ProjectDetailPageProps {
  params: Promise<{ repositoryId: string }>
}

const maturityLabels: Record<ProjectMaturity, string> = {
  early: '早期',
  growth: '成长',
  mature: '成熟',
  stalled: '停滞',
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { repositoryId } = await params
  // 🔰 根据 repositoryId 查询单个项目详情
  const project = await getProjectByRepositoryId(decodeURIComponent(repositoryId))

  if (!project) {
    notFound()
  }

  return (
    <main className="space-y-6">
      <section className="rounded-3xl border border-brand-ring bg-brand-soft p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/40">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm text-brand-text dark:text-emerald-300">项目详情</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-50">{project.fullName}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-700 dark:text-slate-200">{project.description}</p>
          </div>
          <Button asChild className="bg-brand-primary hover:bg-brand-primary-hover dark:bg-emerald-700 dark:hover:bg-emerald-600">
            <a href={project.sourceUrl} target="_blank" rel="noreferrer">打开 GitHub</a>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <DetailCard title="基础信息">
          <DetailRow label="项目名称" value={project.name} />
          <DetailRow label="完整名称" value={project.fullName} />
          <DetailRow label="语言" value={project.language} />
          <DetailRow label="成熟度" value={maturityLabels[project.maturity]} />
          <DetailRow label="关注账号" value={project.sourceGithubUsername} />
          <DetailRow label="备注" value={project.notes || '暂无备注'} />
        </DetailCard>

        <DetailCard title="GitHub 指标">
          <DetailRow label="Stars" value={project.stars.toLocaleString('zh-CN')} />
          <DetailRow label="Forks" value={project.forks.toLocaleString('zh-CN')} />
          <DetailRow label="Issues" value={project.issues.toLocaleString('zh-CN')} />
          <DetailRow label="License" value={project.license || '暂无'} />
          <DetailRow label="Fork 状态" value={project.isFork ? 'Fork 仓库' : '原始仓库'} />
          <DetailRow label="原仓库" value={project.sourceRepositoryFullName || '无'} />
        </DetailCard>

        <DetailCard title="时间信息">
          <DetailRow label="标星时间" value={formatDate(project.starAt)} />
          <DetailRow label="最后活跃" value={formatDate(project.pushedAt ?? project.updatedAt)} />
          <DetailRow label="GitHub 更新" value={formatDate(project.githubUpdatedAt ?? project.updatedAt)} />
        </DetailCard>

        <DetailCard title="标签">
          {project.topics.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {project.topics.map((topic) => (
                <span key={topic} className="rounded-full bg-brand-soft px-3 py-1 text-sm text-brand-text ring-1 ring-brand-ring dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-800">
                  {topic}
                </span>
              ))}
            </div>
          ) : <p className="text-sm text-slate-500 dark:text-slate-400">暂无标签</p>}
        </DetailCard>
      </section>

      <DetailCard title="项目简介">
        <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-200">{project.projectSummary || '暂无项目简介。'}</p>
      </DetailCard>

    </main>
  )
}

// 🔰 带标题的分组卡片，用于详情页分区展示（基础信息、时间信息等）
function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-50">{title}</h3>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  )
}

// 🔰 标签-值网格行，左侧标签 + 右侧内容，用于详情页属性展示
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 text-sm sm:grid-cols-[96px_1fr]">
      <dt className="text-slate-500 dark:text-slate-400">{label}：</dt>
      <dd className="break-words text-slate-700 dark:text-slate-200">{value}</dd>
    </div>
  )
}

// 🔰 取日期字符串前 10 位（YYYY-MM-DD），丢弃时间部分
function formatDate(value: string) {
  return value.slice(0, 10)
}
