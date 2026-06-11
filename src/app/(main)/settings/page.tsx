import { PreferenceForm } from '@/components/settings/preference-form'
import { getDefaultPreference } from '@/lib/default-preference'

export default function SettingsPage() {
  return (
    <main className="space-y-6">
        <section className="space-y-2">
          <h1 className="text-2xl font-semibold">用户设置</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">管理领域偏好、项目推荐提示词和项目简介提示词。</p>
        </section>
        {/* 🔰 获取默认偏好设置，新用户首次访问时的兜底值 */}
        <PreferenceForm initialPreference={getDefaultPreference()} />
      </main>
  )
}
