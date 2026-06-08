import type { UserPreference } from '@/types/insight-radar'

export const preferenceStorageKey = 'insight-radar-user-preference'

export const defaultRecommendationAgentPrompt = `请根据候选项目{candidateProjects}、用户项目需求{projectRequirement}和领域偏好{domainPreferences}写推荐说明。输出内容不超过 200 字，按以下格式输出：
推荐理由：

适用场景：

上手建议：

风险提醒：`

export const defaultProjectProfileAgentPrompt = `请根据项目名称 {projectName}、仓库全名 {repositoryFullName}、项目描述 {projectDescription}、主要语言 {primaryLanguage} 和 README 文档 {readme}，生成不超过 200 字的中文项目简介。简介需要说明项目解决的问题、核心能力、适用场景和主要技术栈，必须是完整句子，不能在句中截断。`

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
