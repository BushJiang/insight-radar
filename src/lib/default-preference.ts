// 用户偏好默认值：推荐/简介提示词模板、normalizePreference 合并用户值到默认值兜底。设置页和 API 路由共用
import type { UserPreference } from '@/types/insight-radar'

// 用户偏好存在 localStorage 中的 key
export const preferenceStorageKey = 'insight-radar-user-preference'
// 推荐提示词的默认模板，用户可在 /settings 页面修改。{{}} 内的变量运行时替换为真实值
export const defaultRecommendationAgentPrompt = `请根据以下信息生成项目推荐理由：
  - 项目名称 {{projectName}}
  - 用户需求 {{query}}
  - 领域偏好 {{domainPreferences}}
  - 语言 {{projectLanguage}}
  - 成熟度 {{maturity}}
  - Stars {{stars}}
  - 来源 {{sourceGithubUsername}}`
// 项目简介生成的默认提示词模板
export const defaultProjectProfileAgentPrompt = `请根据以下信息生成项目简介：
  - 项目名称 {{projectName}}
  - 项目描述 {{projectDescription}}
  - 主要语言 {{projectLanguage}}
  - README 文档 {{readme}}`
// 获取默认偏好设置（新用户首次访问时的兜底值）
export function getDefaultPreference(): UserPreference {
  return {
    id: 'pref-default',
    domains: [],
    recommendationAgentPrompt: defaultRecommendationAgentPrompt,
    projectProfileAgentPrompt: defaultProjectProfileAgentPrompt,
    candidateMultiplier: 4,
    profileConcurrency: 20,
    analysisConcurrency: 2,
    reasonConcurrency: 2,
    updatedAt: new Date().toISOString(),
  }
}

// 合并用户偏好的部分值到默认值，缺失字段用默认值补齐
export function normalizePreference(preference: Partial<UserPreference> | null | undefined): UserPreference {
  const defaultPreference = getDefaultPreference()

  return {
    ...defaultPreference,
    ...preference,
    domains: Array.isArray(preference?.domains) ? preference.domains : defaultPreference.domains,
    recommendationAgentPrompt: preference?.recommendationAgentPrompt || defaultPreference.recommendationAgentPrompt,
    projectProfileAgentPrompt: preference?.projectProfileAgentPrompt || defaultPreference.projectProfileAgentPrompt,
    candidateMultiplier: [2, 4, 8, 16].includes(Number(preference?.candidateMultiplier)) ? Number(preference?.candidateMultiplier) : defaultPreference.candidateMultiplier,
    profileConcurrency: clampConcurrency(preference?.profileConcurrency, [10, 20, 40, 80, 160, 320], defaultPreference.profileConcurrency),
    analysisConcurrency: clampConcurrency(preference?.analysisConcurrency, [2, 4, 8, 16], defaultPreference.analysisConcurrency),
    reasonConcurrency: clampConcurrency(preference?.reasonConcurrency, [2, 4, 8, 16], defaultPreference.reasonConcurrency),
  }
}

function clampConcurrency(value: unknown, options: number[], fallback: number): number {
  const num = Number(value)

  return options.includes(num) ? num : fallback
}
