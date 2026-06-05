import { AppShell } from '@/components/app/app-shell'
import { PreferenceForm } from '@/components/preferences/preference-form'
import { mockPreference } from '@/data/mock-insight-radar'

export default function SettingsPage() {
  return (
    <AppShell currentPath="/settings">
      <main className="space-y-6">
        <section className="space-y-2">
          <h1 className="text-2xl font-semibold">用户设置</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">管理 GitHub API Token、项目领域和推荐排序设置。</p>
        </section>
        <PreferenceForm initialPreference={mockPreference} />
      </main>
    </AppShell>
  )
}
