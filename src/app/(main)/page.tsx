import Link from 'next/link'
import { StatusBadge } from '@/components/layout/status-badge'
import { Container } from '@/components/shared/container'
import { ProjectCard } from '@/components/projects/project-card'
import { getHomeMetrics, getLatestProjects } from '@/lib/projects-repository'

export const revalidate = 3600

export default async function Home() {
  const [metrics, latestProjects] = await Promise.all([
    // 🔰 查询首页统计：项目总数 + 来源账号列表
    getHomeMetrics(),
    // 🔰 按采集时间倒序取最新 N 个项目
    getLatestProjects(4),
  ])
  const visibleSourceUsernames = metrics.sourceUsernames.slice(0, 4)
  const hasMoreSources = metrics.sourceUsernames.length > 4

  return (
    <main className="space-y-8">
      <section className="rounded-3xl bg-green-600 px-6 py-10 text-white shadow-sm sm:px-8 sm:py-10">
        <Container size="sm" className="space-y-4 text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">智源雷达 InsightRadar</h1>
          <p className="text-base text-emerald-50 sm:text-lg">找到 GitHub 上最有价值的开源项目</p>
        </Container>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-50">创建项目库</h2>
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">输入你认可的 GitHub 账号，采集其关注项目并沉淀到项目库。</p>
          </div>
          <Link href="/projects" className="inline-flex h-[46px] items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 active:scale-95">
            创建项目库
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <MetricCard label="项目数量">
          <p className="text-3xl font-semibold tabular-nums text-slate-950 dark:text-slate-50">{metrics.projectCount}</p>
        </MetricCard>
        <MetricCard label="来源账号">
          <div className="flex flex-wrap gap-2">
            {visibleSourceUsernames.map((username) => (
              <StatusBadge key={username} variant="neutral" label={username} />
            ))}
            {hasMoreSources ? <StatusBadge variant="neutral" label="..." /> : null}
            {visibleSourceUsernames.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">暂无来源账号</p> : null}
          </div>
        </MetricCard>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-50">最新关注项目</h2>
          <Link href="/search" className="text-sm font-medium text-emerald-700 transition hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200">
            搜索项目
          </Link>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {latestProjects.map((project) => (
            <ProjectCard key={project.repositoryId} project={project} />
          ))}
        </div>
      </section>


    </main>
  )
}

function MetricCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <div className="mt-3">{children}</div>
    </div>
  )
}
