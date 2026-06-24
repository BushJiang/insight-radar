// 首页错误边界：数据加载失败时展示错误信息和重试按钮
// 错误边界必须是客户端组件，重试按钮需要在浏览器端重置当前路由段
'use client'

import { Button } from '@/components/ui/button'

// HomeError 是首页的路由段错误边界，首页渲染抛错时自动展示
export default function HomeError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900 dark:bg-red-950">
      <p className="text-sm text-red-700 dark:text-red-200">数据加载失败：{error.message}</p>
      <Button variant="destructive" onClick={reset} className="mt-4">
        重试
      </Button>
    </div>
  )
}
