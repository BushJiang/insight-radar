'use client'

import type { ProjectMaturity, ProjectSearchFilters } from '@/types/insight-radar'
import { maturityLabels, maturityOptions, SelectFilter } from '@/components/shared/select-filter'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface RecommendationRequestPanelProps {
  query: string
  filters: ProjectSearchFilters
  sources: string[]
  loading?: boolean
  recommending?: boolean
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

export function RecommendationRequestPanel({ query, filters, sources, loading = false, recommending = false, profileRunning = false, canGenerateProfiles, recommendationLimit, onQueryChange, onFiltersChange, onRecommendationLimitChange, onSourceInputFocus, onSubmit, onGenerateProfiles, onRegenerateProfiles }: RecommendationRequestPanelProps) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <Label htmlFor="recommendation-query" className="text-slate-700 dark:text-slate-200">
        项目需求
      </Label>
      <Textarea
        id="recommendation-query"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        className="mt-2"
        placeholder="描述你想找的项目"
      />

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SelectFilter label="来源账号" value={filters.sourceGithubUsername ?? ''} options={sources} allLabel="全部来源" onChange={(value) => onFiltersChange({ sourceGithubUsername: value || null })} onFocus={onSourceInputFocus} />
        <SelectFilter label="语言" value={filters.languages[0] ?? ''} options={['TypeScript', 'Python', 'Go', 'Rust', '其他']} allLabel="全部语言" onChange={(value) => onFiltersChange({ languages: value ? [value] : [] })} />
        <SelectFilter label="项目成熟度" value={filters.maturity[0] ?? ''} options={maturityOptions} allLabel="全部成熟度" optionLabels={maturityLabels} onChange={(value) => onFiltersChange({ maturity: value ? [value as ProjectMaturity] : [] })} />
        <SelectFilter label="时间范围" value={String(filters.days ?? '')} options={['7', '30', '90', '']} optionLabels={{ '7': '最近 7 天', '30': '最近 30 天', '90': '最近 90 天', '': '不限时间' }} onChange={(value) => onFiltersChange({ days: value ? Number(value) : null })} />
        <div>
          <Label htmlFor="recommendation-limit">推荐数量</Label>
          <Input
            id="recommendation-limit"
            type="number"
            min={1}
            max={50}
            value={recommendationLimit}
            onChange={(event) => onRecommendationLimitChange(Math.max(1, Math.min(50, Number(event.target.value) || 1)))}
            className="mt-2"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="submit" disabled={loading || profileRunning} className="bg-brand-primary hover:bg-brand-primary-hover active:scale-95">
          {recommending ? '正在推荐' : '智能推荐'}
        </Button>
        <Button type="button" variant="outline" disabled={loading || profileRunning || !canGenerateProfiles} onClick={onGenerateProfiles} className="active:scale-95">
          生成项目简介
        </Button>
        <Button type="button" disabled={loading || profileRunning} onClick={onRegenerateProfiles} className="bg-brand-primary hover:bg-brand-primary-hover active:scale-95">
          重新生成项目简介
        </Button>
      </div>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        智能推荐会先从项目库语义搜索候选项目，再结合项目需求和领域偏好生成推荐建议。
      </p>
    </form>
  )
}

