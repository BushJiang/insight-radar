// 🔰 空状态占位：数据为空时的虚线边框提示框。搜索/推荐/项目库等多页复用
interface EmptyStateProps {
  message: string
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
      {message}
    </div>
  )
}
