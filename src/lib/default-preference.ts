import type { UserPreference } from '@/types/insight-radar'

export const preferenceStorageKey = 'insight-radar-user-preference'

export const defaultRecommendationAgentPrompt = `你是智源雷达的项目推荐智能体。请严格基于候选项目和用户需求推荐项目，不要编造候选项目之外的信息。请结合变量 {domainPreferences}、{projectRequirement}、{finalRecommendationCount}、{candidateProjectCount} 和 {candidateProjects} 进行判断。输出每个推荐项目的推荐理由、适用场景、上手建议、风险提醒和来源链接。`

export const defaultProjectProfileAgentPrompt = `你是智源雷达的项目简介生成智能体。请根据变量 {projectName}、{repositoryFullName}、{projectDescription}、{primaryLanguage} 和 {readme} 生成不超过 200 字的完整中文项目简介，说明项目解决的问题、核心能力、适合场景和主要技术栈。`

export function getDefaultPreference(): UserPreference {
  return {
    id: 'pref-default',
    domains: [],
    recommendationAgentPrompt: defaultRecommendationAgentPrompt,
    projectProfileAgentPrompt: defaultProjectProfileAgentPrompt,
    candidateProjectCount: 10,
    updatedAt: new Date().toISOString(),
  }
}

export function normalizePreference(preference: Partial<UserPreference> | null | undefined): UserPreference {
  const defaultPreference = getDefaultPreference()

  return {
    ...defaultPreference,
    ...preference,
    domains: Array.isArray(preference?.domains) ? preference.domains : defaultPreference.domains,
    recommendationAgentPrompt: preference?.recommendationAgentPrompt || defaultPreference.recommendationAgentPrompt,
    projectProfileAgentPrompt: preference?.projectProfileAgentPrompt || defaultPreference.projectProfileAgentPrompt,
    candidateProjectCount: Math.max(1, Math.min(50, Number(preference?.candidateProjectCount) || defaultPreference.candidateProjectCount)),
  }
}
