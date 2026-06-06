'use client'

import type { ProjectMaturity, ProjectSearchFilters } from '@/types/insight-radar'

const maturityOptions: ProjectMaturity[] = ['early', 'growth', 'mature', 'stalled']
const maturityLabels: Record<ProjectMaturity, string> = {
  early: '早期',
  growth: '成长',
  mature: '成熟',
  stalled: '停滞',
}

interface RecommendationRequestPanelProps {
  query: string
  filters: ProjectSearchFilters
  sources: string[]
  loading?: boolean
  profileRunning?: boolean
  canGenerateProfiles: boolean
  recommendationLimit: number
  onQueryChange: (value: string) => void
  onFiltersChange: (filters: Partial<ProjectSearchFilters>) => void
  onRecommendationLimitChange: (limit: number) => void
  onSourceInputFocus?: () => void
  onSubmit: () => void
  onGenerateProfiles: () => void
  onRegenerateProfiles: () => void
}

export function RecommendationRequestPanel({ query, filters, sources, loading = false, profileRunning = false, canGenerateProfiles, recommendationLimit, onQueryChange, onFiltersChange, onRecommendationLimitChange, onSourceInputFocus, onSubmit, onGenerateProfiles, onRegenerateProfiles }: RecommendationRequestPanelProps) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <label htmlFor="recommendation-query" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
        项目需求
      </label>
      <textarea
        id="recommendation-query"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="描述你想找的项目"
        className="mt-2 min-h-28 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-950"
      />

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SelectFilter label="来源账号" value={filters.sourceGithubUsername ?? ''} options={sources} allLabel="全部来源" onChange={(value) => onFiltersChange({ sourceGithubUsername: value || null })} onFocus={onSourceInputFocus} />
        <SelectFilter label="语言" value={filters.languages[0] ?? ''} options={['TypeScript', 'Python', 'Go', 'Rust', '其他']} allLabel="全部语言" onChange={(value) => onFiltersChange({ languages: value ? [value] : [] })} />
        <SelectFilter label="项目成熟度" value={filters.maturity[0] ?? ''} options={maturityOptions} allLabel="全部成熟度" optionLabels={maturityLabels} onChange={(value) => onFiltersChange({ maturity: value ? [value as ProjectMaturity] : [] })} />
        <SelectFilter label="时间范围" value={String(filters.days ?? '')} options={['7', '30', '90', '']} optionLabels={{ '7': '最近 7 天', '30': '最近 30 天', '90': '最近 90 天', '': '不限时间' }} onChange={(value) => onFiltersChange({ days: value ? Number(value) : null })} />
        <div>
          <label htmlFor="recommendation-limit" className="block text-sm font-medium text-black dark:text-black">推荐数量</label>
          <input
            id="recommendation-limit"
            type="number"
            min={1}
            max={50}
            value={recommendationLimit}
            onChange={(event) => onRecommendationLimitChange(Math.max(1, Math.min(50, Number(event.target.value) || 1)))}
            className="mt-2 h-[46px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-black shadow-sm outline-none transition dark:border-slate-700 dark:bg-white dark:text-black"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button type="submit" disabled={loading || profileRunning} className="h-[46px] cursor-pointer rounded-xl bg-brand-primary px-5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-primary-hover active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:hover:bg-slate-400">
          {profileRunning ? '正在生成项目简介' : loading ? '正在推荐' : '智能推荐'}
        </button>
        <button type="button" disabled={loading || profileRunning || !canGenerateProfiles} onClick={onGenerateProfiles} className="h-[46px] cursor-pointer rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900 dark:disabled:bg-slate-800 dark:disabled:text-slate-500">
          生成项目简介
        </button>
        <button type="button" disabled={loading || profileRunning} onClick={onRegenerateProfiles} className="h-[46px] cursor-pointer rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900 dark:disabled:bg-slate-800 dark:disabled:text-slate-500">
          重新生成项目简介
        </button>
      </div>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        智能推荐会先从项目库语义搜索候选项目，再结合项目需求和领域偏好生成推荐建议。
      </p>
    </form>
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
  const id = `recommendation-filter-${label}`

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
