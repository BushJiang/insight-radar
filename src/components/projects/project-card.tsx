import Link from 'next/link'
import type { GithubProject, ProjectMaturity } from '@/types/insight-radar'

interface ProjectCardProps {
  project: GithubProject
  recommendationReason?: string
}

const maturityLabels: Record<ProjectMaturity, string> = {
  early: '早期',
  growth: '成长',
  mature: '成熟',
  stalled: '停滞',
}

export function ProjectCard({ project, recommendationReason }: ProjectCardProps) {
  const watchedAccounts = formatWatchedAccounts([project.sourceGithubUsername])
  const visibleTopics = project.topics.slice(0, 5)

  return (
    <article className="group relative flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/40">
      <Link href={`/projects/${encodeURIComponent(project.repositoryId)}`} aria-label={`查看 ${project.fullName} 的项目详情`} className="absolute inset-0 rounded-3xl focus:outline-none" />
      <div>
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <h3 className="block truncate text-lg font-semibold text-slate-950 dark:text-slate-50">
              {project.fullName}
            </h3>
            <a href={project.sourceUrl} target="_blank" rel="noreferrer" className="relative z-10 inline-flex shrink-0 cursor-pointer items-center rounded-lg px-2 py-1 text-sm font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200">
              打开 GitHub
            </a>
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{project.description}</p>
        </div>
      </div>

      <dl className="mt-5 flex-1 space-y-2 rounded-2xl bg-slate-50 p-4 text-sm leading-6 transition group-hover:bg-emerald-50 group-focus-within:bg-emerald-50 dark:bg-slate-950 dark:group-hover:bg-emerald-950/40 dark:group-focus-within:bg-emerald-950/40">
        <InfoRow label="标星时间">{formatDate(project.starAt)}</InfoRow>
        <InfoRow label="最后活跃">{formatDate(project.pushedAt ?? project.updatedAt)}</InfoRow>
        <InfoRow label="成熟度">{maturityLabels[project.maturity]}</InfoRow>
        <InfoRow label="标签">
          {visibleTopics.length > 0 ? (
            <span className="flex flex-wrap gap-1.5">
              {visibleTopics.map((topic) => (
                <span key={topic} className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-700 ring-1 ring-slate-200 transition group-hover:bg-emerald-50 group-hover:text-emerald-800 group-hover:ring-emerald-200 group-focus-within:bg-emerald-50 group-focus-within:text-emerald-800 group-focus-within:ring-emerald-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800 dark:group-hover:bg-emerald-950/40 dark:group-hover:text-emerald-100 dark:group-hover:ring-emerald-700 dark:group-focus-within:bg-emerald-950/40 dark:group-focus-within:text-emerald-100 dark:group-focus-within:ring-emerald-700">
                  {topic}
                </span>
              ))}
            </span>
          ) : '暂无标签'}
        </InfoRow>
        <InfoRow label="语言">{project.language}</InfoRow>
        <InfoRow label="关注账号">{watchedAccounts}</InfoRow>
        {recommendationReason ? <InfoRow label="推荐理由">{recommendationReason}</InfoRow> : null}
      </dl>
    </article>
  )
}

function formatWatchedAccounts(accounts: string[]) {
  const visibleAccounts = accounts.slice(0, 4)
  const suffix = accounts.length > 4 ? '...' : ''

  return `${visibleAccounts.join('、')}${suffix}`
}

function formatDate(value: string) {
  return value.slice(0, 10)
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[72px_1fr]">
      <dt className="text-slate-500 dark:text-slate-400">{label}：</dt>
      <dd className="text-slate-700 dark:text-slate-200">{children}</dd>
    </div>
  )
}
