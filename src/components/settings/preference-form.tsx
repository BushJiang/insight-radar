// 用户偏好表单：领域选择 + 推荐/简介提示词模板 + 候选池倍数，数据保存到 localStorage。设置页使用
'use client'

import { useState } from 'react'
import { getDefaultPreference, normalizePreference, preferenceStorageKey } from '@/lib/default-preference'
import { readBrowserStorage, writeBrowserStorage } from '@/lib/browser-storage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { UserPreference } from '@/types/insight-radar'

interface PreferenceFormProps {
  initialPreference: UserPreference
}

interface PreferenceFormState {
  preference: UserPreference
  otherDomainEnabled: boolean
  otherDomain: string
}

const unlimitedDomain = '不限领域'
const domains = [unlimitedDomain, '智能体', '前端', '后端', '数据库', 'AI 工具', '开发工具', '基础设施']
const githubTokenStorageKey = 'insight-radar-github-token'

// 用户设置表单，编辑领域偏好、推荐提示词、项目简介提示词，数据存 localStorage
export function PreferenceForm({ initialPreference }: PreferenceFormProps) {
  const [savedState, setSavedState] = useState<PreferenceFormState>(() => {
    const saved = readBrowserStorage(preferenceStorageKey, null)

    return {
      preference: saved ? normalizePreference(saved) : normalizePreference(initialPreference),
      otherDomainEnabled: false,
      otherDomain: '',
    }
  })
  const [githubToken, setGithubToken] = useState(() => readBrowserStorage(githubTokenStorageKey, ''))
  const [saved, setSaved] = useState(false)
  const { preference, otherDomainEnabled, otherDomain } = savedState
  const githubTokenMask = githubToken ? '*'.repeat(githubToken.length) : ''

  function saveSettings() {
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

    writeBrowserStorage(preferenceStorageKey, nextPreference)
    writeBrowserStorage(githubTokenStorageKey, githubToken.trim())
    setGithubToken(githubToken.trim())
    setSavedState({
      preference: nextPreference,
      otherDomainEnabled,
      otherDomain: trimmedOtherDomain,
    })
    setSaved(true)
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

  return (
    <div className="space-y-6">
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

      <PreferenceCard title="GitHub Token">
        <Input
          id="github-token"
          type="text"
          value={githubTokenMask}
          onChange={(event) => {
            setSaved(false)
            setGithubToken(event.target.value)
          }}
          placeholder="请输入 GitHub Token"
          autoComplete="off"
        />
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">保存后会写入浏览器本地存储，采集 GitHub Star 项目时自动使用。</p>
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
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">并发数越大，执行速度越快，消耗 token 越多。</p>
      </PreferenceCard>

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

      <div className="min-h-20">
        <Button
          type="button"
          onClick={saveSettings}
          className="bg-brand-primary hover:bg-brand-primary-hover active:scale-95"
        >
          保存设置
        </Button>
        <p className={`mt-3 text-sm text-brand-text dark:text-emerald-300 ${saved ? 'visible' : 'invisible'}`}>{saved ? '设置已保存到本地。' : '占位'}</p>
      </div>
    </div>
  )
}

interface PreferenceCardProps {
  title: string
  children: React.ReactNode
}

function PreferenceCard({ title, children, action }: PreferenceCardProps & { action?: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
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
