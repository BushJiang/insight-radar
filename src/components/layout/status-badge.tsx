// 状态标签徽章：根据 variant（采集状态/置信度）自动变色，用于首页来源账号和采集任务状态展示
import type { CollectionJobStatus, RecommendationConfidence } from '@/types/insight-radar'

type StatusBadgeVariant = CollectionJobStatus | RecommendationConfidence | 'brand'

const statusClassNames: Record<StatusBadgeVariant, string> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200',
  running: 'border-brand-ring bg-brand-soft text-brand-text dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
  success: 'border-brand-ring bg-brand-soft text-brand-text dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  partial_success: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200',
  failed: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200',
  high: 'border-brand-ring bg-brand-soft text-brand-text dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  medium: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200',
  low: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200',
  brand: 'border-brand-ring bg-brand-soft text-brand-text dark:border-brand-ring dark:bg-brand-soft dark:text-brand-text',
}
// statusLabels 是 variant 的默认显示文字。StatusBadge 接收 variant 和可选的 label，如果没传 label，就用 statusLabels[variant] 作为显示文字。
const statusLabels: Record<StatusBadgeVariant, string> = {
  pending: '等待中',
  running: '采集中',
  success: '成功',
  partial_success: '部分成功',
  failed: '失败',
  high: '高置信',
  medium: '中置信',
  low: '低置信',
  brand: '来源',
}

interface StatusBadgeProps {
  variant: StatusBadgeVariant
  label?: string
}

// 状态标签徽章，根据 variant 自动变色（success=绿、failed=红、pending=黄）
export function StatusBadge({ variant, label }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusClassNames[variant]}`}>
      {label ?? statusLabels[variant]}
    </span>
  )
}
