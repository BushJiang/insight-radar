export default function ProjectDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-64 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
      ))}
    </div>
  )
}
