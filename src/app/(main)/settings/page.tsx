// 用户设置页：服务端组件 + 客户端子组件 PreferenceForm，管理领域偏好和提示词模板
import { PreferenceForm } from '@/components/settings/preference-form'
import { getDefaultPreference } from '@/lib/default-preference'

// SettingsPage 是设置页的服务端入口，先取默认偏好，再把初始值交给客户端表单
export default function SettingsPage() {
  return (
    <main className="space-y-6">
      {/* 页面标题先说明这里能改什么，让用户知道进入的是偏好配置页 */}
        <section className="space-y-2">
          <h1 className="text-2xl font-semibold">用户设置</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">管理领域偏好、项目推荐提示词和项目简介提示词。</p>
        </section>
        {/* 获取默认偏好设置，新用户首次访问时的兜底值 */}
        <PreferenceForm initialPreference={getDefaultPreference()} />
      </main>
  )
}
