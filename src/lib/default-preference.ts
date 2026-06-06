import type { UserPreference } from '@/types/insight-radar'

export function getDefaultPreference(): UserPreference {
  return {
    id: 'pref-default',
    domains: [],
    languages: [],
    maturity: [],
    intent: 'learning',
    rankingMode: 'no_preference',
    updatedAt: new Date().toISOString(),
  }
}
