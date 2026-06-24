// 加载提示：数据请求中的灰底文字提示框。搜索页使用
interface LoadingMessageProps {
  message?: string
}

export function LoadingMessage({ message = '正在加载数据' }: LoadingMessageProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
      {message}
    </div>
  )
}
