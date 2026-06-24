// 项目详情页：Next.js 服务端组件会先在服务端查库，再把生成好的 HTML 返回给浏览器
import { notFound } from 'next/navigation'
import { getProjectByRepositoryId } from '@/lib/projects-repository'
import { Button } from '@/components/ui/button'
import type { ProjectMaturity } from '@/types/insight-radar'

// revalidate=60 让详情页最多缓存 60 秒，类似 Python 后端给查询结果加短 TTL 缓存
export const revalidate = 60

// 页面参数由 Next.js 动态路由提供，类型里保留 Promise 是为了匹配当前版本的服务端组件参数约定
interface ProjectDetailPageProps {
  params: Promise<{ repositoryId: string }>
}

// 成熟度字段在数据层是枚举值，渲染前统一映射成中文文案，避免 JSX 里散落多处判断
const maturityLabels: Record<ProjectMaturity, string> = {
  early: '早期',
  growth: '成长',
  mature: '成熟',
  stalled: '停滞',
}

// ProjectDetailPage 是详情页的主流程：解析路由参数、查询项目、处理不存在、渲染详情内容
export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { repositoryId } = await params
  // 动态路由参数来自 URL，先 decode 再查库，避免带斜杠或特殊字符的仓库名匹配失败
  const project = await getProjectByRepositoryId(decodeURIComponent(repositoryId))

  if (!project) {
    // notFound 会交给 Next.js 渲染 404 页面，等价于后端路由里主动返回 404 响应
    notFound()
  }

  return (
    <main className="space-y-6">
      {/* 顶部摘要区先展示仓库名称、简介和外链，帮助用户快速确认是不是目标项目 */}
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

      {/* 下面的网格把详情拆成多个信息区，方便按主题快速扫读 */}
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

// DetailCard 是详情页的通用分组容器，统一每个信息区的边框、标题和间距
function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-50">{title}</h3>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  )
}

// DetailRow 把每个字段渲染成固定的标签-值布局，让不同卡片里的信息对齐
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 text-sm sm:grid-cols-[96px_1fr]">
      <dt className="text-slate-500 dark:text-slate-400">{label}：</dt>
      <dd className="break-words text-slate-700 dark:text-slate-200">{value}</dd>
    </div>
  )
}

// formatDate 只保留 YYYY-MM-DD，让 GitHub 时间戳在页面上更适合快速阅读
function formatDate(value: string) {
  return value.slice(0, 10)
}
