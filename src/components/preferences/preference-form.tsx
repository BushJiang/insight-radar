'use client'

import { useState } from 'react'
import { normalizePreference, preferenceStorageKey } from '@/lib/default-preference'
import { writeBrowserStorage } from '@/lib/browser-storage'
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

export function PreferenceForm({ initialPreference }: PreferenceFormProps) {
  const [savedState, setSavedState] = useState<PreferenceFormState>(() => ({
    preference: normalizePreference(initialPreference),
    otherDomainEnabled: false,
    otherDomain: '',
  }))
  const [saved, setSaved] = useState(false)
  const { preference, otherDomainEnabled, otherDomain } = savedState

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

      <PreferenceCard title="推荐智能体提示词">
        <textarea
          value={preference.recommendationAgentPrompt}
          onChange={(event) => updatePreference({ recommendationAgentPrompt: event.target.value })}
          className="min-h-36 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-black outline-none transition placeholder:text-slate-500 dark:border-slate-700 dark:bg-white dark:text-black"
          placeholder="请输入推荐智能体提示词"
        />
        <p className="text-sm text-slate-500 dark:text-slate-400">可用变量：{'{domainPreferences}'}（领域偏好）、{'{projectRequirement}'}（项目需求）、{'{finalRecommendationCount}'}（最终推荐数量）、{'{candidateProjectCount}'}（候选项目数量）、{'{candidateProjects}'}（候选项目）。</p>
      </PreferenceCard>

      <PreferenceCard title="项目简介生成提示词">
        <textarea
          value={preference.projectProfileAgentPrompt}
          onChange={(event) => updatePreference({ projectProfileAgentPrompt: event.target.value })}
          className="min-h-36 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-black outline-none transition placeholder:text-slate-500 dark:border-slate-700 dark:bg-white dark:text-black"
          placeholder="请输入项目简介生成提示词"
        />
        <p className="text-sm text-slate-500 dark:text-slate-400">可用变量：{'{projectName}'}（项目名称）、{'{repositoryFullName}'}（仓库全名）、{'{projectDescription}'}（项目描述）、{'{primaryLanguage}'}（主要语言）、{'{readme}'}（README 内容）。</p>
      </PreferenceCard>

      <PreferenceCard title="候选项目数量">
        <input
          id="candidate-project-count"
          type="number"
          min={1}
          max={50}
          step={1}
          value={preference.candidateProjectCount}
          onChange={(event) => updatePreference({ candidateProjectCount: Number(event.target.value) || 1 })}
          className="mt-2 h-[46px] w-full max-w-48 rounded-xl border border-slate-300 bg-white px-4 text-sm text-black outline-none transition placeholder:text-slate-500 dark:border-slate-700 dark:bg-white dark:text-black"
        />
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">系统会先从项目库找出这些候选项目，再由推荐智能体筛选出最终推荐数量。</p>
      </PreferenceCard>

      <div className="min-h-20">
        <button
          type="button"
          onClick={saveSettings}
          className="h-[46px] cursor-pointer rounded-xl bg-emerald-700 px-5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-800 active:scale-95"
        >
          保存设置
        </button>
        <p className={`mt-3 text-sm text-emerald-600 dark:text-emerald-300 ${saved ? 'visible' : 'invisible'}`}>{saved ? '设置已保存到本地。' : '占位'}</p>
      </div>
    </div>
  )
}

interface PreferenceCardProps {
  title: string
  children: React.ReactNode
}

function PreferenceCard({ title, children }: PreferenceCardProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
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
        <label key={value} className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${selected.includes(value) ? 'border-emerald-700 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-slate-200 dark:border-slate-700'}`}>
          <span className={`flex h-4 w-4 items-center justify-center rounded border transition ${selected.includes(value) ? 'border-emerald-700 bg-emerald-700 dark:border-emerald-600 dark:bg-emerald-600' : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900'}`}>
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
      <label className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${checked ? 'border-emerald-700 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-slate-200 dark:border-slate-700'}`}>
        <span className={`flex h-4 w-4 items-center justify-center rounded border transition ${checked ? 'border-emerald-700 bg-emerald-700 dark:border-emerald-600 dark:bg-emerald-600' : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900'}`}>
          {checked ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
        </span>
        <input type="checkbox" checked={checked} onChange={(event) => onCheckedChange(event.target.checked)} className="sr-only" />
        {label}
      </label>
      <input
        type="text"
        value={value}
        disabled={!checked}
        onChange={(event) => onValueChange(event.target.value)}
        className="h-[46px] w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-black outline-none transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-white dark:text-black dark:disabled:bg-slate-800 dark:disabled:text-slate-500 sm:max-w-sm"
        placeholder="请输入其他偏好"
      />
    </div>
  )
}
