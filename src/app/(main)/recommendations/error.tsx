// 推荐页错误边界是客户端组件，因为重试按钮要在浏览器里重新触发页面恢复
'use client'

import { Button } from '@/components/ui/button'

// RecommendationsError 是推荐页的错误边界，数据请求失败时自动渲染
export default function RecommendationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900 dark:bg-red-950">
      <p className="text-sm text-red-700 dark:text-red-200">推荐数据加载失败：{error.message}</p>
      {/* reset 是 Next.js 错误边界提供的恢复入口，点击后会重新尝试渲染推荐页 */}
      <Button variant="destructive" onClick={reset} className="mt-4">
        重试
      </Button>
    </div>
  )
}
