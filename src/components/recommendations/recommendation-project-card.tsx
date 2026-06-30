import Link from 'next/link'
import type { GithubProject, ProjectRecommendationReason, ProjectScore } from '@/types/insight-radar'
import { Button } from '@/components/ui/button'

interface RecommendationProjectCardProps {
  project: GithubProject
  score: ProjectScore | undefined
  reason: ProjectRecommendationReason | undefined
}

const dimensionOrder = ['需求匹配度', '内容质量', '项目成熟度', '活跃度', '可信度']
const dimensionLabels: Record<string, string> = {
  '需求匹配度': '需求匹配',
  '项目成熟度': '成熟度',
  '活跃度': '活跃度',
  '内容质量': '内容质量',
  '可信度': '可信度',
}

export function RecommendationProjectCard({ project, score, reason }: RecommendationProjectCardProps) {
  const fitReasons = reason?.fitReasons ?? []
  const riskReminder = reason?.riskReminder ?? ''
  const summary = project.projectSummary || '暂无项目简介'

  return (
    <article className="group relative flex h-full min-h-[680px] flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-ring hover:bg-brand-soft hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/40">
      <Link href={`/projects/${encodeURIComponent(project.repositoryId)}`} aria-label={`查看 ${project.fullName} 的项目详情`} className="absolute inset-0 rounded-3xl focus:outline-none" />
      <div className="relative z-10 flex h-8 items-start justify-between gap-3">
        <h3 className="min-w-0 truncate text-lg font-semibold text-slate-950 dark:text-slate-50">
          {project.fullName}
        </h3>
        <Button asChild type="button" className="bg-brand-primary hover:bg-brand-primary-hover active:scale-95">
          <a href={project.sourceUrl} target="_blank" rel="noreferrer" className="shrink-0">
            打开 GitHub
          </a>
        </Button>
      </div>

      <p className="mt-3 line-clamp-7 text-sm leading-6 text-slate-600 dark:text-slate-300">
        {summary}
      </p>

      <div className="mt-5 h-[220px] border-t border-slate-200 pt-5 dark:border-slate-800">
        <div className="flex items-center justify-between gap-3">
          <p className="text-base font-semibold text-slate-700 dark:text-slate-200">项目评分</p>
          {score ? <ScoreValue value={score.totalScore} size="md" /> : null}
        </div>
        <div className="mt-3 space-y-2">
          {dimensionOrder.map((dimension) => {
            const value = score?.dimensions[dimension] ?? 0

            return (
              <div key={dimension} className="flex items-center justify-between gap-4">
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {dimensionLabels[dimension] ?? dimension}
                </span>
                <StarRating value={value} size="sm" showNumber />
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-5 h-[200px] border-t border-slate-200 pt-5 dark:border-slate-800">
        <p className="text-base font-semibold text-brand-text dark:text-emerald-300">为什么适合你</p>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-800 dark:text-slate-100">
          {fitReasons.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-900 dark:bg-slate-100" />
              <span className="line-clamp-2">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative z-10 mt-auto h-[80px] border-t border-slate-200 pt-5 dark:border-slate-800">
        {riskReminder ? (
          <div className="flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            <span aria-hidden="true">⚠</span>
            <span className="line-clamp-2">{riskReminder}</span>
          </div>
        ) : null}
      </div>
    </article>
  )
}

function ScoreValue({ value, size = 'sm' }: { value: number; size?: 'sm' | 'md' }) {
  const normalizedValue = Math.max(0, Math.min(5, value))
  const valueClassName = size === 'md' ? 'text-base' : 'text-sm'

  return (
    <span className={`tabular-nums font-semibold text-slate-700 dark:text-slate-200 ${valueClassName}`} aria-label={`${normalizedValue.toFixed(1)} 分`}>
      <span className="text-brand-primary dark:text-emerald-300">{normalizedValue.toFixed(1)}</span> / 5.0
    </span>
  )
}

function StarRating({ value, showNumber = false, size = 'sm' }: { value: number; showNumber?: boolean; size?: 'sm' | 'md' }) {
  const normalizedValue = Math.max(0, Math.min(5, value))
  const filledCount = Math.round(normalizedValue)
  const starClassName = size === 'md' ? 'text-xl' : 'text-lg'

  return (
    <span className="inline-flex items-center gap-1 tabular-nums" aria-label={`${normalizedValue.toFixed(1)} 分`}>
      <span className={`inline-flex tracking-tight ${starClassName}`} aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} className={index < filledCount ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300 dark:text-slate-700'}>
            ★
          </span>
        ))}
      </span>
      {showNumber ? (
        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
          {normalizedValue.toFixed(size === 'md' ? 1 : 0)}
        </span>
      ) : null}
    </span>
  )
}
