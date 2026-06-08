import type { CollectionJobStatus, RecommendationConfidence } from '@/types/insight-radar'

type StatusBadgeVariant = CollectionJobStatus | RecommendationConfidence | 'neutral'

const statusClassNames: Record<StatusBadgeVariant, string> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200',
  running: 'border-emerald-200 bg-brand-soft text-brand-text dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  partial_success: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200',
  failed: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200',
  high: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  medium: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200',
  low: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200',
  neutral: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200',
}

const statusLabels: Record<StatusBadgeVariant, string> = {
  pending: '等待中',
  running: '采集中',
  success: '成功',
  partial_success: '部分成功',
  failed: '失败',
  high: '高置信',
  medium: '中置信',
  low: '低置信',
  neutral: '中性',
}

interface StatusBadgeProps {
  variant: StatusBadgeVariant
  label?: string
}

export function StatusBadge({ variant, label }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusClassNames[variant]}`}>
      {label ?? statusLabels[variant]}
    </span>
  )
}
