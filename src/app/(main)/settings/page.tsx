// 用户设置页：服务端组件 + 客户端子组件 PreferenceForm，管理密钥状态、领域偏好和提示词模板
import { PreferenceForm } from '@/components/settings/preference-form'
import { getAppSettingsSnapshot } from '@/lib/app-settings-service'

// SettingsPage 是设置页的服务端入口，读取服务端保存的设置状态，再把初始值交给客户端表单
export default async function SettingsPage() {
  const settings = await getAppSettingsSnapshot()

  return (
    <main className="space-y-6">
      {/* 页面标题先说明这里能改什么，让用户知道进入的是偏好配置页 */}
      <section className="space-y-2">
        <h1 className="text-lg font-semibold">用户设置</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">管理 API 密钥、推荐偏好和领域偏好、生成速度和提示词模板。</p>
      </section>
      {/* 表单只接收密钥状态，不接收密钥明文 */}
      <PreferenceForm initialPreference={settings.preference} initialApiKeyStatus={settings.apiKeyStatus} />
    </main>
  )
}
