import { AppShell } from '@/components/app/app-shell'
import { mockProjects } from '@/data/mock-insight-radar'

export default function Home() {
  return (
    <AppShell currentPath="/">
      <main className="space-y-6">
        <section className="rounded-3xl bg-green-600 p-6 text-white shadow-sm sm:p-8">
          <div className="max-w-3xl space-y-5 mx-auto">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">找到 GitHub 上最有价值的开源项目</h1>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <MetricCard label="项目数量" value={mockProjects.length} />
          <MetricCard label="来源账号" value={new Set(mockProjects.map((project) => project.sourceGithubUsername)).size} />
        </section>
      </main>
    </AppShell>
  )
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}
