'use client'

import type { ProjectMaturity } from '@/types/insight-radar'

export const maturityOptions: ProjectMaturity[] = ['early', 'growth', 'mature', 'stalled']

export const maturityLabels: Record<ProjectMaturity, string> = {
  early: '早期',
  growth: '成长',
  mature: '成熟',
  stalled: '停滞',
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

export function SelectFilter({ label, value, options, allLabel, optionLabels, onChange, onFocus }: SelectFilterProps) {
  const id = `filter-${label.replace(/\s+/g, '-').toLowerCase()}`

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
