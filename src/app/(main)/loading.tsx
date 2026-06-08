export default function HomeLoading() {
  return (
    <div className="space-y-6">
      <section className="grid gap-6 sm:grid-cols-2">
        <div className="h-32 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="h-32 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
      </section>
      <section className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        ))}
      </section>
    </div>
  )
}
