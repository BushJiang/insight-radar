// 用户偏好表单：API 密钥状态、推荐偏好、执行参数和提示词模板，数据保存到服务端设置表。设置页使用
'use client'

import { useState } from 'react'
import { getDefaultPreference, normalizePreference } from '@/lib/default-preference'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { UserApiKeys, UserPreference } from '@/types/insight-radar'

interface PreferenceFormProps {
  initialPreference: UserPreference
  initialApiKeyStatus: Record<keyof UserApiKeys, boolean>
}

interface PreferenceFormState {
  preference: UserPreference
  otherDomainEnabled: boolean
  otherDomain: string
}

const unlimitedDomain = '不限领域'
const domains = [unlimitedDomain, '智能体', '前端', '后端', '数据库', 'AI 工具', '开发工具', '基础设施']
const emptyApiKeys: UserApiKeys = { githubToken: '', deepseekApiKey: '', siliconFlowApiKey: '' }

// 用户设置表单，编辑领域偏好、API 密钥、执行参数和提示词模板，数据存服务端设置表
export function PreferenceForm({ initialPreference, initialApiKeyStatus }: PreferenceFormProps) {
  const [savedState, setSavedState] = useState<PreferenceFormState>(() => ({
    preference: normalizePreference(initialPreference),
    otherDomainEnabled: false,
    otherDomain: '',
  }))
  const [apiKeyStatus, setApiKeyStatus] = useState(initialApiKeyStatus)
  const [apiKeyDrafts, setApiKeyDrafts] = useState<UserApiKeys>(emptyApiKeys)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { preference, otherDomainEnabled, otherDomain } = savedState

  async function saveSettings() {
    const trimmedOtherDomain = otherDomain.trim()
    const nextDomains = preference.domains.includes(unlimitedDomain)
      ? []
      : [
        ...preference.domains.filter((domain) => domains.includes(domain) && domain !== unlimitedDomain),
        ...(otherDomainEnabled && trimmedOtherDomain ? [trimmedOtherDomain] : []),
      ]
    const nextPreference = normalizePreference({
      ...preference,
      domains: Array.from(new Set(nextDomains)),
      updatedAt: new Date().toISOString(),
    })

    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preference: nextPreference, apiKeys: apiKeyDrafts }),
      })
      const result = await response.json() as { preference?: UserPreference; apiKeyStatus?: Record<keyof UserApiKeys, boolean>; error?: string | null }

      if (!response.ok || result.error || !result.preference || !result.apiKeyStatus) {
        setError(result.error || '保存设置失败，请稍后重试。')
        return
      }

      setApiKeyStatus(result.apiKeyStatus)
      setApiKeyDrafts(emptyApiKeys)
      setSavedState({
        preference: normalizePreference(result.preference),
        otherDomainEnabled,
        otherDomain: trimmedOtherDomain,
      })
      setSaved(true)
    } catch {
      setError('保存设置失败，请稍后重试。')
    } finally {
      setSaving(false)
    }
  }

  function toggleDomain(value: string) {
    setSaved(false)
    setSavedState((currentState) => {
      const baseDomains = currentState.preference.domains.filter((domain) => domains.includes(domain))

      if (value === unlimitedDomain) {
        return {
          ...currentState,
          otherDomainEnabled: false,
          otherDomain: '',
          preference: {
            ...currentState.preference,
            domains: baseDomains.includes(unlimitedDomain) ? [] : [unlimitedDomain],
          },
        }
      }

      const activeDomains = baseDomains.filter((domain) => domain !== unlimitedDomain)
      const nextDomains = activeDomains.includes(value) ? activeDomains.filter((domain) => domain !== value) : [...activeDomains, value]

      return {
        ...currentState,
        preference: {
          ...currentState.preference,
          domains: nextDomains,
        },
      }
    })
  }

  function updatePreference(nextPreference: Partial<UserPreference>) {
    setSaved(false)
    setSavedState((currentState) => ({
      ...currentState,
      preference: normalizePreference({
        ...currentState.preference,
        ...nextPreference,
      }),
    }))
  }

  function updateApiKeyDraft(key: keyof UserApiKeys, value: string) {
    setSaved(false)
    setApiKeyDrafts((currentDrafts) => ({ ...currentDrafts, [key]: value }))
  }

  return (
    <div className="space-y-8">
      <SettingsGroup title="API 密钥" description="密钥会保存到数据库，页面只显示是否已设置。">
        <div className="grid gap-4 lg:grid-row-3">
          <ApiKeyInput
            id="github-token"
            label="GitHub Token"
            saved={apiKeyStatus.githubToken}
            value={apiKeyDrafts.githubToken}
            placeholder={apiKeyStatus.githubToken ? '输入新的 GitHub Token，留空表示不修改' : '请输入 GitHub Token'}
            onChange={(value) => updateApiKeyDraft('githubToken', value)}
          />
          <ApiKeyInput
            id="deepseek-api-key"
            label="DeepSeek API Key"
            saved={apiKeyStatus.deepseekApiKey}
            value={apiKeyDrafts.deepseekApiKey}
            placeholder={apiKeyStatus.deepseekApiKey ? '输入新的 DeepSeek API Key，留空表示不修改' : '请输入 DeepSeek API Key'}
            onChange={(value) => updateApiKeyDraft('deepseekApiKey', value)}
          />
          <ApiKeyInput
            id="siliconflow-api-key"
            label="SiliconFlow API Key"
            saved={apiKeyStatus.siliconFlowApiKey}
            value={apiKeyDrafts.siliconFlowApiKey}
            placeholder={apiKeyStatus.siliconFlowApiKey ? '输入新的 SiliconFlow API Key，留空表示不修改' : '请输入 SiliconFlow API Key'}
            onChange={(value) => updateApiKeyDraft('siliconFlowApiKey', value)}
          />
        </div>
      </SettingsGroup>

      <SettingsGroup title="推荐偏好" description="控制推荐结果更偏向哪些技术领域，以及候选项目搜索范围。">
        <PreferenceCard title="领域偏好">
          <CheckboxGroup values={domains} selected={preference.domains} onToggle={toggleDomain} />
          <OtherInput
            label="其他"
            checked={otherDomainEnabled}
            value={otherDomain}
            onCheckedChange={(checked) => {
              setSaved(false)
              setSavedState((currentState) => ({
                ...currentState,
                otherDomainEnabled: checked,
                preference: checked
                  ? {
                    ...currentState.preference,
                    domains: currentState.preference.domains.filter((domain) => domain !== unlimitedDomain),
                  }
                  : currentState.preference,
              }))
            }}
            onValueChange={(value) => {
              setSaved(false)
              setSavedState((currentState) => ({
                ...currentState,
                otherDomain: value,
              }))
            }}
          />
        </PreferenceCard>

        <PreferenceCard title="候选池倍数">
          <Select value={String(preference.candidateMultiplier)} onValueChange={(value) => updatePreference({ candidateMultiplier: Number(value) })}>
            <SelectTrigger className="mt-2 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2, 4, 8, 16].map((value) => (
                <SelectItem key={value} value={String(value)}>{value}×</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">候选池项目数量 = 推荐数量 × 候选池倍数。候选池倍数越大，搜索范围越广，但是消耗 token 越多。</p>
        </PreferenceCard>
      </SettingsGroup>

      <SettingsGroup title="生成速度" description="控制任务运行速度。并发数越大，运行速度越快，token 消耗越多。">
        <PreferenceCard title="并发数设置">
          <div className="grid gap-4 sm:grid-cols-3">
            <ConcurrencySelect
              id="profile-concurrency"
              label="简介生成并发数"
              value={preference.profileConcurrency}
              options={[10, 20, 40, 80, 160, 320]}
              onChange={(val) => updatePreference({ profileConcurrency: val })}
            />
            <ConcurrencySelect
              id="analysis-concurrency"
              label="分析评分并发数"
              value={preference.analysisConcurrency}
              options={[2, 4, 8, 16]}
              onChange={(val) => updatePreference({ analysisConcurrency: val })}
            />
            <ConcurrencySelect
              id="reason-concurrency"
              label="推荐理由并发数"
              value={preference.reasonConcurrency}
              options={[2, 4, 8, 16]}
              onChange={(val) => updatePreference({ reasonConcurrency: val })}
            />
          </div>
        </PreferenceCard>
      </SettingsGroup>

      <SettingsGroup title="提示词模板" description="用于自定义提示词。">
        <PreferenceCard
          title="项目简介提示词"
          action={<Button type="button" size="sm" onClick={() => updatePreference({ projectProfileAgentPrompt: getDefaultPreference().projectProfileAgentPrompt })} className="bg-brand-primary hover:bg-brand-primary-hover active:scale-95">恢复默认</Button>}
        >
          <Textarea
            value={preference.projectProfileAgentPrompt}
            onChange={(event) => updatePreference({ projectProfileAgentPrompt: event.target.value })}
            placeholder="请输入项目简介提示词"
          />
        </PreferenceCard>

        <PreferenceCard
          title="项目推荐提示词"
          action={<Button type="button" size="sm" onClick={() => updatePreference({ recommendationAgentPrompt: getDefaultPreference().recommendationAgentPrompt })} className="bg-brand-primary hover:bg-brand-primary-hover active:scale-95">恢复默认</Button>}
        >
          <Textarea
            value={preference.recommendationAgentPrompt}
            onChange={(event) => updatePreference({ recommendationAgentPrompt: event.target.value })}
            placeholder="请输入项目推荐提示词"
          />
        </PreferenceCard>
      </SettingsGroup>

      <div className="min-h-20">
        <Button
          type="button"
          onClick={() => void saveSettings()}
          disabled={saving}
          className="bg-brand-primary hover:bg-brand-primary-hover active:scale-95"
        >
          {saving ? '保存中...' : '保存设置'}
        </Button>
        <p className={`mt-3 text-sm ${error ? 'text-red-500' : 'text-brand-text dark:text-emerald-300'} ${saved || error ? 'visible' : 'invisible'}`}>{error || (saved ? '设置已保存' : '占位')}</p>
      </div>
    </div>
  )
}

interface SettingsGroupProps {
  title: string
  description: string
  children: React.ReactNode
}

function SettingsGroup({ title, description, children }: SettingsGroupProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <div className="mt-5 space-y-5">
        {children}
      </div>
    </section>
  )
}

interface ApiKeyInputProps {
  id: string
  label: string
  saved: boolean
  value: string
  placeholder: string
  onChange: (value: string) => void
}

function ApiKeyInput({ id, label, saved, value, placeholder, onChange }: ApiKeyInputProps) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        <span className={`text-xs ${saved ? 'text-brand-text dark:text-emerald-300' : 'text-slate-400 dark:text-slate-500'}`}>{saved ? '已保存' : '未设置'}</span>
      </div>
      <Input
        id={id}
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="mt-2"
      />
    </div>
  )
}

interface PreferenceCardProps {
  title: string
  children: React.ReactNode
}

function PreferenceCard({ title, children, action }: PreferenceCardProps & { action?: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        {action}
      </div>
      <div>
        {children}
      </div>
    </section>
  )
}

interface CheckboxGroupProps<T extends string> {
  values: readonly T[]
  selected: T[]
  onToggle: (value: T) => void
}

function CheckboxGroup<T extends string>({ values, selected, onToggle }: CheckboxGroupProps<T>) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <label key={value} className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${selected.includes(value) ? 'border-brand-primary bg-brand-soft text-brand-text dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-slate-200 dark:border-slate-700'}`}>
          <span className={`flex h-4 w-4 items-center justify-center rounded border transition ${selected.includes(value) ? 'border-brand-primary bg-brand-primary dark:border-emerald-600 dark:bg-emerald-600' : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900'}`}>
            {selected.includes(value) ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
          </span>
          <input type="checkbox" checked={selected.includes(value)} onChange={() => onToggle(value)} className="sr-only" />
          {value}
        </label>
      ))}
    </div>
  )
}

interface OtherInputProps {
  label: string
  checked: boolean
  value: string
  onCheckedChange: (checked: boolean) => void
  onValueChange: (value: string) => void
}

function OtherInput({ label, checked, value, onCheckedChange, onValueChange }: OtherInputProps) {
  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <label className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${checked ? 'border-brand-primary bg-brand-soft text-brand-text dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-slate-200 dark:border-slate-700'}`}>
        <span className={`flex h-4 w-4 items-center justify-center rounded border transition ${checked ? 'border-brand-primary bg-brand-primary dark:border-emerald-600 dark:bg-emerald-600' : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900'}`}>
          {checked ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
        </span>
        <input type="checkbox" checked={checked} onChange={(event) => onCheckedChange(event.target.checked)} className="sr-only" />
        {label}
      </label>
      <Input
        type="text"
        value={value}
        disabled={!checked}
        onChange={(event) => onValueChange(event.target.value)}
        className="sm:max-w-sm"
        placeholder="请输入其他偏好"
      />
    </div>
  )
}

// 并发数下拉选择框
function ConcurrencySelect({ id, label, value, options, onChange }: { id: string; label: string; value: number; options: number[]; onChange: (val: number) => void }) {
  return (
    <div>
      <Label htmlFor={id} className="text-sm">{label}</Label>
      <Select value={String(value)} onValueChange={(val) => onChange(Number(val))}>
        <SelectTrigger id={id} className="mt-2 w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={String(option)}>{option}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
