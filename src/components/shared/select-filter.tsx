'use client'

import type { ProjectMaturity } from '@/types/insight-radar'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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

const EMPTY_MARKER = '__empty__'

// Radix Select 不允许 SelectItem 的 value 为空字符串，用占位值代替
function safeValue(v: string) {
  return v || EMPTY_MARKER
}

export function SelectFilter({ label, value, options, allLabel, optionLabels, onChange, onFocus }: SelectFilterProps) {
  function handleChange(v: string) {
    onChange(v === EMPTY_MARKER ? '' : v)
  }

  return (
    <div>
      <Label className="text-black dark:text-black">{label}</Label>
      <Select value={safeValue(value)} onValueChange={handleChange}>
        <SelectTrigger className="mt-2 w-full" onFocus={onFocus}>
          <SelectValue placeholder={allLabel ?? '请选择'} />
        </SelectTrigger>
        <SelectContent>
          {allLabel ? <SelectItem value={EMPTY_MARKER}>{allLabel}</SelectItem> : null}
          {options.map((option) => (
            <SelectItem key={option} value={safeValue(option)}>{optionLabels?.[option] ?? option}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
