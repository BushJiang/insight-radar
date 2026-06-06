'use client'

import type { ProjectMaturity, ProjectSearchFilters } from '@/types/insight-radar'

const maturityOptions: ProjectMaturity[] = ['early', 'growth', 'mature', 'stalled']
const maturityLabels: Record<ProjectMaturity, string> = {
  early: '早期',
  growth: '成长',
  mature: '成熟',
  stalled: '停滞',
}

interface ProjectSearchBarProps {
  filters: ProjectSearchFilters
  sources: string[]
  loading?: boolean
  onSearch: () => void
  onChange: (filters: Partial<ProjectSearchFilters>) => void
  onSourceInputFocus?: () => void
}

export function ProjectSearchBar({ filters, sources, loading = false, onSearch, onChange, onSourceInputFocus }: ProjectSearchBarProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(280px,1fr)_120px]">
        <div>
          <label htmlFor="query" className="block text-sm font-medium text-black dark:text-black">项目搜索</label>
          <input
            id="query"
            type="search"
            value={filters.query}
            onChange={(event) => onChange({ query: event.target.value })}
            className="mt-2 h-[46px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-black shadow-sm outline-none transition placeholder:text-slate-500 dark:border-slate-700 dark:bg-white dark:text-black"
            placeholder="输入关键词，搜索项目名称、描述、README"
          />
        </div>
        <button type="button" disabled={loading} onClick={onSearch} className="mt-7 inline-flex h-[46px] cursor-pointer items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-400">
          搜索
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SelectFilter label="来源账号" value={filters.sourceGithubUsername ?? ''} options={sources} allLabel="全部来源" onChange={(value) => onChange({ sourceGithubUsername: value || null })} onFocus={onSourceInputFocus} />
        <SelectFilter label="语言" value={filters.languages[0] ?? ''} options={['TypeScript', 'Python', 'Go', 'Rust', '其他']} allLabel="全部语言" onChange={(value) => onChange({ languages: value ? [value] : [] })} />
        <SelectFilter label="项目成熟度" value={filters.maturity[0] ?? ''} options={maturityOptions} allLabel="全部成熟度" optionLabels={maturityLabels} onChange={(value) => onChange({ maturity: value ? [value as ProjectMaturity] : [] })} />
        <SelectFilter label="时间范围" value={String(filters.days ?? '')} options={['7', '30', '90', '']} optionLabels={{ '7': '最近 7 天', '30': '最近 30 天', '90': '最近 90 天', '': '不限时间' }} onChange={(value) => onChange({ days: value ? Number(value) : null })} />
      </div>
    </div>
  )
}

interface SelectFilterProps {
  label: string
  value: string
  options: string[]
  allLabel?: string
  optionLabels?: Record<string, string>
  onChange: (value: string) => void
  onFocus?: () => void
}

function SelectFilter({ label, value, options, allLabel, optionLabels, onChange, onFocus }: SelectFilterProps) {
  const id = `filter-${label}`

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-black dark:text-black">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        className="mt-2 h-[46px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-black shadow-sm outline-none transition dark:border-slate-700 dark:bg-white dark:text-black"
      >
        {allLabel ? <option value="">{allLabel}</option> : null}
        {options.map((option) => (
          <option key={option} value={option}>{optionLabels?.[option] ?? option}</option>
        ))}
      </select>
    </div>
  )
}
