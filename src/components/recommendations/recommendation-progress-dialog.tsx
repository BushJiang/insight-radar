// 推荐进度弹窗：显示智能推荐各阶段的执行进度，样式与项目库构建弹窗一致
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface RecommendationProgressDialogProps {
  open: boolean
  stepIndex: number
  failed: boolean
  errorMessage: string | null
  onClose: () => void
}

const steps = [
  { label: '向量搜索', icon: '🔍' },
  { label: '分析评分', icon: '📊' },
  { label: '生成推荐理由', icon: '🤖' },
]

export function RecommendationProgressDialog({ open, stepIndex, failed, errorMessage, onClose }: RecommendationProgressDialogProps) {
  if (!open) return null

  const running = !failed && stepIndex < steps.length
  const success = !failed && stepIndex >= steps.length
  const resolvedStepIndex = success ? steps.length - 1 : Math.min(Math.max(stepIndex, 0), steps.length - 1)
  const title = failed ? '推荐失败' : success ? '推荐完成' : '正在推荐'
  const completedStepCount = success ? steps.length : running ? resolvedStepIndex : Math.max(0, resolvedStepIndex)
  const progressWidth = `${completedStepCount * (100 / steps.length)}%`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-sm">
      <section className="flex h-[300px] w-full max-w-md flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-2xl text-brand-primary">
            {failed ? '!' : success ? '✓' : '◌'}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-50">{title}</h2>
          </div>
        </div>

        <div className="mt-6">
          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                failed ? 'bg-destructive' : 'bg-brand-primary',
                running ? 'animate-pulse' : null,
              )}
              style={{ width: progressWidth }}
            />
          </div>
        </div>

        <ol className="mt-6 flex-1 space-y-3">
          {steps.map((step, index) => {
            const completed = success || index < resolvedStepIndex
            const active = running && index === resolvedStepIndex
            const stepFailed = failed && index === resolvedStepIndex

            return (
              <li key={step.label} className="flex items-center gap-3 text-sm">
                <span className="flex w-8 shrink-0 items-center justify-center">
                  {completed ? (
                    <span className="text-2xl leading-none text-brand-primary">✓</span>
                  ) : active ? (
                    <span className="size-5 rounded-full border-3 border-brand-primary border-r-transparent motion-safe:animate-spin" />
                  ) : stepFailed ? (
                    <span className="flex size-6 items-center justify-center rounded-full bg-destructive/10 text-sm font-semibold text-destructive">!</span>
                  ) : (
                    <span className="size-3 rounded-full bg-slate-300 dark:bg-slate-600" />
                  )}
                </span>
                <span className={cn(
                  'text-lg leading-none',
                  active ? 'font-semibold text-slate-950 dark:text-slate-50' : null,
                  completed ? 'font-normal text-slate-700 dark:text-slate-200' : null,
                  !completed && !active && !stepFailed ? 'font-normal text-slate-400 dark:text-slate-500' : null,
                  stepFailed ? 'font-semibold text-destructive' : null,
                )}>
                  <span className="mr-2">{step.icon}</span>
                  {step.label}
                </span>
              </li>
            )
          })}
        </ol>

        <div className="mt-6 flex h-8 items-center justify-between gap-4">
          {failed && errorMessage ? (
            <p className="min-w-0 truncate text-sm text-destructive">{errorMessage}</p>
          ) : (
            <span />
          )}
          {failed ? (
            <Button type="button" onClick={onClose} className="bg-brand-primary hover:bg-brand-primary-hover active:scale-95">
              关闭
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  )
}
