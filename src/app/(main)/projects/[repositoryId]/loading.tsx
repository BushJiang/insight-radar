// ProjectDetailLoading 是 Next.js 约定的路由段加载页，详情数据未返回前会自动展示
export default function ProjectDetailLoading() {
  return (
    <div className="space-y-6">
      {/* 顶部标题占位，避免页面一开始空白过久 */}
      <div className="h-8 w-64 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
      {/* 下面四块占位对应详情页的主要信息分区 */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
      ))}
    </div>
  )
}
