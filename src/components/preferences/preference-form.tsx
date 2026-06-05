'use client'

import { useState } from 'react'
import { readBrowserStorage, writeBrowserStorage } from '@/lib/browser-storage'
import type { ProjectMaturity, UserPreference } from '@/types/insight-radar'

interface PreferenceFormProps {
  initialPreference: UserPreference
}

interface PreferenceFormState {
  preference: UserPreference
  githubToken: string
  otherDomainEnabled: boolean
  otherDomain: string
  otherLanguageEnabled: boolean
  otherLanguage: string
}

const domains = ['智能体', '前端', '后端', '数据库', 'AI 工具', '开发工具', '基础设施']
const languages = ['TypeScript', 'Python', 'Go', 'Rust', 'JavaScript']
const maturities = ['unlimited', 'early', 'growth', 'mature', 'stalled'] as const
const maturityLabels: Record<typeof maturities[number], string> = {
  unlimited: '无限制',
  early: '早期',
  growth: '成长',
  mature: '成熟',
  stalled: '停滞',
}
const rankingModes: Array<UserPreference['rankingMode']> = ['new', 'mature', 'growth', 'multi_source', 'no_preference']
const rankingModeLabels: Record<UserPreference['rankingMode'], string> = {
  new: '优先新项目',
  mature: '优先成熟项目',
  growth: '优先成长项目',
  multi_source: '优先多来源项目',
  no_preference: '无偏好',
}

const githubTokenStorageKey = 'insight-radar-github-token'
const preferenceStorageKey = 'insight-radar-user-preference'

function getSavedPreferenceState(initialPreference: UserPreference): PreferenceFormState {
  const savedPreference = readBrowserStorage(preferenceStorageKey, initialPreference)
  const savedGithubToken = readBrowserStorage(githubTokenStorageKey, '')
  const savedOtherDomain = savedPreference.domains.find((domain) => !domains.includes(domain)) ?? ''
  const savedOtherLanguage = savedPreference.languages.find((language) => !languages.includes(language)) ?? ''

  return {
    preference: savedPreference,
    githubToken: savedGithubToken,
    otherDomainEnabled: savedOtherDomain.length > 0,
    otherDomain: savedOtherDomain,
    otherLanguageEnabled: savedOtherLanguage.length > 0,
    otherLanguage: savedOtherLanguage,
  }
}

export function PreferenceForm({ initialPreference }: PreferenceFormProps) {
  const [savedState, setSavedState] = useState<PreferenceFormState>(() => ({
    preference: initialPreference,
    githubToken: '',
    otherDomainEnabled: false,
    otherDomain: '',
    otherLanguageEnabled: false,
    otherLanguage: '',
  }))
  const [saved, setSaved] = useState(false)

  const { preference, githubToken, otherDomainEnabled, otherDomain, otherLanguageEnabled, otherLanguage } = savedState

  function restoreSavedState() {
    setSavedState(getSavedPreferenceState(initialPreference))
  }

  function saveSettings() {
    const trimmedOtherDomain = otherDomain.trim()
    const trimmedOtherLanguage = otherLanguage.trim()
    const nextDomains = [
      ...preference.domains.filter((domain) => domains.includes(domain)),
      ...(otherDomainEnabled && trimmedOtherDomain ? [trimmedOtherDomain] : []),
    ]
    const nextLanguages = [
      ...preference.languages.filter((language) => languages.includes(language)),
      ...(otherLanguageEnabled && trimmedOtherLanguage ? [trimmedOtherLanguage] : []),
    ]
    const nextPreference = {
      ...preference,
      domains: Array.from(new Set(nextDomains)),
      languages: Array.from(new Set(nextLanguages)),
      updatedAt: new Date().toISOString(),
    }

    window.localStorage.setItem(githubTokenStorageKey, githubToken.trim())
    writeBrowserStorage(preferenceStorageKey, nextPreference)
    setSavedState({
      preference: nextPreference,
      githubToken: githubToken.trim(),
      otherDomainEnabled,
      otherDomain: trimmedOtherDomain,
      otherLanguageEnabled,
      otherLanguage: trimmedOtherLanguage,
    })
    setSaved(true)
  }

  function toggleListValue<T extends string>(key: 'domains' | 'languages' | 'maturity', value: T) {
    setSaved(false)
    setSavedState((currentState) => {
      const current = currentState.preference
      const list = current[key] as T[]

      if (key === 'maturity') {
        if (value === 'unlimited') {
          return {
            ...currentState,
            preference: {
              ...current,
              maturity: [],
            },
          }
        }

        const nextList = list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
        return {
          ...currentState,
          preference: {
            ...current,
            maturity: nextList as ProjectMaturity[],
          },
        }
      }

      const baseList = key === 'domains'
        ? current.domains.filter((item) => domains.includes(item)) as T[]
        : key === 'languages'
          ? current.languages.filter((item) => languages.includes(item)) as T[]
          : list
      const nextList = baseList.includes(value) ? baseList.filter((item) => item !== value) : [...baseList, value]

      return {
        ...currentState,
        preference: {
          ...current,
          [key]: nextList,
        },
      }
    })
  }

  return (
    <div className="space-y-6">
      <PreferenceCard title="GitHub 设置">
        <label htmlFor="github-token" className="block text-sm font-medium text-slate-700 dark:text-slate-200">GitHub Token</label>
        <input
          id="github-token"
          type="password"
          value={githubToken}
          onChange={(event) => {
            setSaved(false)
            setSavedState((currentState) => ({
              ...currentState,
              githubToken: event.target.value,
            }))
          }}
          className="mt-2 h-[46px] w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-black outline-none transition placeholder:text-slate-500 dark:border-slate-700 dark:bg-white dark:text-black"
          placeholder="可选；用于提高 GitHub API 调用限额"
        />
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Token 仅保存到当前浏览器本地，用于搜索来源账号 Star 的项目。</p>
      </PreferenceCard>

      <PreferenceCard title="领域偏好">
        <CheckboxGroup values={domains} selected={preference.domains} onToggle={(value) => toggleListValue('domains', value)} />
        <OtherInput
          label="其他"
          checked={otherDomainEnabled}
          value={otherDomain}
          onCheckedChange={(checked) => {
            setSaved(false)
            setSavedState((currentState) => ({
              ...currentState,
              otherDomainEnabled: checked,
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

      <PreferenceCard title="语言偏好">
        <CheckboxGroup values={languages} selected={preference.languages} onToggle={(value) => toggleListValue('languages', value)} />
        <OtherInput
          label="其他"
          checked={otherLanguageEnabled}
          value={otherLanguage}
          onCheckedChange={(checked) => {
            setSaved(false)
            setSavedState((currentState) => ({
              ...currentState,
              otherLanguageEnabled: checked,
            }))
          }}
          onValueChange={(value) => {
            setSaved(false)
            setSavedState((currentState) => ({
              ...currentState,
              otherLanguage: value,
            }))
          }}
        />
      </PreferenceCard>

      <PreferenceCard title="成熟度偏好">
        <CheckboxGroup values={maturities} labels={maturityLabels} selected={preference.maturity.length === 0 ? ['unlimited'] : preference.maturity} onToggle={(value) => toggleListValue('maturity', value)} />
      </PreferenceCard>

      <PreferenceCard title="排序偏好">
        <div className="flex flex-wrap gap-2">
          {rankingModes.map((mode) => (
            <label key={mode} className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${preference.rankingMode === mode ? 'border-emerald-700 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-slate-200 dark:border-slate-700'}`}>
              <input
                type="radio"
                name="rankingMode"
                checked={preference.rankingMode === mode}
                onChange={() => {
                  setSaved(false)
                  setSavedState((currentState) => ({
                    ...currentState,
                    preference: {
                      ...currentState.preference,
                      rankingMode: mode,
                    },
                  }))
                }}
                className="accent-emerald-700"
              />
              {rankingModeLabels[mode]}
            </label>
          ))}
        </div>
      </PreferenceCard>

      <div className="min-h-20">
        <button
          type="button"
          onClick={restoreSavedState}
          className="h-[46px] cursor-pointer rounded-xl border border-emerald-200 bg-white px-5 text-sm font-medium text-emerald-700 shadow-sm transition hover:bg-emerald-50 active:scale-95 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
        >
          恢复已保存设置
        </button>
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
  labels?: Record<T, string>
  selected: T[]
  onToggle: (value: T) => void
}

function CheckboxGroup<T extends string>({ values, labels, selected, onToggle }: CheckboxGroupProps<T>) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <label key={value} className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${selected.includes(value) ? 'border-emerald-700 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-slate-200 dark:border-slate-700'}`}>
          <span className={`flex h-4 w-4 items-center justify-center rounded border transition ${selected.includes(value) ? 'border-emerald-700 bg-emerald-700 dark:border-emerald-600 dark:bg-emerald-600' : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900'}`}>
            {selected.includes(value) ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
          </span>
          <input type="checkbox" checked={selected.includes(value)} onChange={() => onToggle(value)} className="sr-only" />
          {labels?.[value] ?? value}
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
