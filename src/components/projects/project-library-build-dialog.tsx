import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { CollectionJobStatus } from '@/types/insight-radar'

interface ProjectLibraryBuildDialogProps {
  open: boolean
  status: CollectionJobStatus
  activeStepIndex: number
  fetchedCount?: number
  estimatedTotalCount?: number | null
  errorMessage: string | null
  onClose: () => void
}

const buildSteps = [
  { label: '采集 GitHub 项目', icon: '📦' },
  { label: '生成项目简介', icon: '📝' },
  { label: '生成项目向量', icon: '✨' },
  { label: '写入 Milvus 向量库', icon: '🗄️' },
]

export function ProjectLibraryBuildDialog({ open, status, activeStepIndex, onClose }: ProjectLibraryBuildDialogProps) {
  if (!open) {
    return null
  }

  const running = status === 'running' || status === 'pending'
  const failed = status === 'failed'
  const success = status === 'success' || status === 'partial_success'
  const resolvedActiveStepIndex = success ? buildSteps.length - 1 : Math.min(Math.max(activeStepIndex, 0), buildSteps.length - 1)
  const title = failed
    ? '项目库构建失败'
    : success
      ? '项目库已构建完成'
      : '项目库构建中'
  const completedStepCount = success ? buildSteps.length : running ? resolvedActiveStepIndex : Math.max(0, resolvedActiveStepIndex)
  const progressWidth = failed
    ? `${completedStepCount * 25}%`
    : `${completedStepCount * 25}%`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-sm">
      <section className="flex h-[440px] w-full max-w-lg flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
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
          {buildSteps.map((step, index) => {
            const completed = success || index < resolvedActiveStepIndex
            const active = running && index === resolvedActiveStepIndex
            const stepFailed = failed && index === resolvedActiveStepIndex

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
                <span className={cn('text-xl leading-none', active ? 'font-semibold text-slate-950 dark:text-slate-50' : null, completed ? 'font-normal text-slate-700 dark:text-slate-200' : null, !completed && !active && !stepFailed ? 'font-normal text-slate-400 dark:text-slate-500' : null, stepFailed ? 'font-semibold text-destructive' : null)}>
                  <span className="mr-2">{step.icon}</span>
                  {step.label}
                </span>
              </li>
            )
          })}
        </ol>

        <div className="mt-6 flex h-8 justify-end">
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
