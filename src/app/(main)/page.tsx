// 首页：服务端组件 + ISR（revalidate=3600），展示项目统计、来源账号、最新关注项目
import Link from 'next/link'
import { StatusBadge } from '@/components/layout/status-badge'
import { Container } from '@/components/shared/container'
import { ProjectCard } from '@/components/projects/project-card'
import { Button } from '@/components/ui/button'
import { getHomeMetrics, getLatestProjects } from '@/lib/projects-repository'
// revalidate=60 让首页数据最多缓存 60 秒再更新
export const revalidate = 60

// Home 是首页服务端组件，并行查询统计指标和最新项目后渲染页面
export default async function Home() {
  // Promise.all 并发请求统计数据和项目列表，两个查询互不依赖，减少总等待时间
  const [metrics, latestProjects] = await Promise.all([
    // 查询首页统计：项目总数 + 来源账号列表
    getHomeMetrics(),
    // 按采集时间倒序取最新 N 个项目
    getLatestProjects(4),
  ])
  // 来源卡片空间有限，最多展示 4 个，多余的用 ... 提示
  const visibleSourceUsernames = metrics.sourceUsernames.slice(0, 4)
  // 来源数超过 4 个时多出一个省略号标签
  const hasMoreSources = metrics.sourceUsernames.length > 4

  return (
    <main className="space-y-8">
      {/* 首屏 Hero 区：产品名称 + 一句话定位，让用户立刻知道这个工具是做什么的 */}
      <section className="rounded-3xl bg-green-600 px-6 py-10 text-white shadow-sm sm:px-8 sm:py-10">
        <Container size="sm" className="space-y-4 text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">智源雷达 InsightRadar</h1>
          <p className="text-base text-emerald-50 sm:text-lg">找到 GitHub 上最有价值的开源项目</p>
        </Container>
      </section>

      {/* 创建项目库引导区：把用户引向核心功能入口 */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-50">创建项目库</h2>
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">输入你认可的 GitHub 账号，采集其关注项目并沉淀到项目库。</p>
          </div>
          <Button asChild className="bg-brand-primary hover:bg-brand-primary-hover active:scale-95">
            <Link href="/projects">创建项目库</Link>
          </Button>
        </div>
      </section>

      {/* 数据概览区：项目总数和来源账号一目了然 */}
      <section className="grid gap-4 md:grid-cols-2">
        <MetricCard label="项目数量">
          <p className="text-3xl font-semibold tabular-nums text-slate-950 dark:text-slate-50">{metrics.projectCount}</p>
        </MetricCard>
        <MetricCard label="来源账号">
          <div className="flex flex-wrap gap-2">
            {visibleSourceUsernames.map((username) => (
              <StatusBadge key={username} variant="brand" label={username} />
            ))}
            {/* 来源超过 4 个时展示省略号，避免标签溢出 */}
            {hasMoreSources ? <StatusBadge variant="brand" label="..." /> : null}
            {/* 还没有来源账号时展示兜底文案，避免空白卡片 */}
            {visibleSourceUsernames.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">暂无来源账号</p> : null}
          </div>
        </MetricCard>
      </section>

      {/* 最新项目区：引导用户进入搜索页查看更多 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-50">最新关注项目</h2>
          <Link href="/search" className="text-sm font-medium text-brand-text transition hover:text-brand-text-hover dark:text-emerald-300 dark:hover:text-emerald-200">
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

// MetricCard 是首页统计卡片的通用容器，上面放标签文字、下面放统计数字
function MetricCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <div className="mt-3">{children}</div>
    </div>
  )
}
