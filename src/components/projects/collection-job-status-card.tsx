import { StatusBadge } from '@/components/layout/status-badge'
import type { CollectionJob } from '@/types/insight-radar'

interface CollectionJobStatusCardProps {
  job: CollectionJob
}

// 🔰 采集任务状态卡片，展示最后一次采集的结果（来源账号、新增/重复/失败数量）
export function CollectionJobStatusCard({ job }: CollectionJobStatusCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">来源账号：{job.githubUsername}</p>
        <StatusBadge variant={job.status} />
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
          <dt className="text-xs text-slate-500 dark:text-slate-400">新增项目</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{job.createdProjectCount}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
          <dt className="text-xs text-slate-500 dark:text-slate-400">重复项目</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{job.duplicateProjectCount ?? 0}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
          <dt className="text-xs text-slate-500 dark:text-slate-400">失败数量</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{job.failedCount}</dd>
        </div>
      </dl>

      {job.errorMessage ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {job.errorMessage}
        </div>
      ) : null}
    </article>
  )
}
