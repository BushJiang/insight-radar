import type { UserPreference } from '@/types/insight-radar'

export const preferenceStorageKey = 'insight-radar-user-preference'

export const defaultRecommendationAgentPrompt = `你是推荐智能体。请严格根据候选项目{candidateProjects}、用户项目需求{projectRequirement}和领域偏好{domainPreferences}写推荐说明，不要编造候选项目之外的信息。输出内容不超过200字，格式如下所示：
推荐理由：
上手建议：
风险提醒：`

export const defaultProjectProfileAgentPrompt = `你是目简介智能体。请严格根据项目名称 {projectName}、{repositoryFullName}、项目描述 {projectDescription}、项目主要语言 {primaryLanguage} 和README文档 {readme} ，生成不超过 200 字的中文项目简介，说明项目解决的问题、核心能力和适用场景。`

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
