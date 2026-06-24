// 错误边界组件必须是客户端组件，因为 reset 重试动作需要在浏览器里触发
'use client'

import { Button } from '@/components/ui/button'

// ProjectDetailError 是 Next.js 约定的路由段错误边界，当前项目详情页抛错时会自动渲染它
export default function ProjectDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900 dark:bg-red-950">
      <p className="text-sm text-red-700 dark:text-red-200">项目详情加载失败：{error.message}</p>
      {/* reset 是 Next.js 错误边界提供的重试入口，点击后会重新渲染当前出错的页面段 */}
      <Button variant="destructive" onClick={reset} className="mt-4">
        重试
      </Button>
    </div>
  )
}
