'use client'

import type { ProjectSearchFilters } from '@/types/insight-radar'

interface ProjectFilterPanelProps {
  filters: ProjectSearchFilters
  sources: string[]
  onChange: (filters: Partial<ProjectSearchFilters>) => void
}

export function ProjectFilterPanel({ filters, sources, onChange }: ProjectFilterPanelProps) {
  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="space-y-5">
        <div>
          <label htmlFor="source" className="block text-sm font-medium text-slate-700 dark:text-slate-200">来源账号</label>
          <select
            id="source"
            value={filters.sourceGithubUsername ?? ''}
            onChange={(event) => onChange({ sourceGithubUsername: event.target.value || null })}
            className="mt-2 h-[46px] w-full rounded-xl border border-slate-300 bg-white px-4 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">全部来源</option>
            {sources.map((source) => <option key={source} value={source}>{source}</option>)}
          </select>
        </div>
      </div>
    </aside>
  )
}
