'use client'

import { Button } from '@/components/ui/button'

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
