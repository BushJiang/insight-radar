// 搜索栏：关键词输入 + 四个下拉筛选（来源/语言/成熟度/时间范围）+ 搜索按钮。搜索页使用
'use client'

import type { ProjectMaturity, ProjectSearchFilters } from '@/types/insight-radar'
import { maturityLabels, maturityOptions, SelectFilter } from '@/components/shared/select-filter'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
      <div className="grid items-end gap-3 lg:grid-cols-[minmax(280px,1fr)_120px]">
        <div>
          <Label htmlFor="query">项目搜索</Label>
          <Input
            id="query"
            type="search"
            className="mt-2"
            value={filters.query}
            onChange={(event) => onChange({ query: event.target.value })}
            onKeyDown={(event) => { if (event.key === 'Enter') onSearch() }}
            placeholder="输入关键词，搜索项目名称、描述、README"
          />
        </div>
        <Button type="button" disabled={loading} onClick={onSearch} className="bg-brand-primary hover:bg-brand-primary-hover active:scale-95 disabled:bg-slate-400">
          搜索
        </Button>
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
