// 🔰 用户偏好默认值：推荐/简介提示词模板、normalizePreference 合并用户值到默认值兜底。设置页和 API 路由共用
import type { UserPreference } from '@/types/insight-radar'

// 🔰 用户偏好存在 localStorage 中的 key
export const preferenceStorageKey = 'insight-radar-user-preference'
// 🔰 推荐提示词的默认模板，用户可在 /settings 页面修改。{{}} 内的变量运行时替换为真实值
export const defaultRecommendationAgentPrompt = `请根据领域偏好{{domainPreferences}}和用户需求{{query}}，为项目{{projectFullName}}写推荐说明。项目简介：{{projectSummary}}，语言：{{projectLanguage}}，成熟度：{{maturity}}，Stars：{{stars}}，来源：{{sourceGithubUsername}}。`
// 🔰 项目简介生成的默认提示词模板
export const defaultProjectProfileAgentPrompt = `请根据项目名称{{projectName}}、仓库全名{{repositoryFullName}}、项目描述{{projectDescription}}、主要语言{{primaryLanguage}}和 README 文档{{readme}}，生成不超过 200 字的中文项目简介。简介需要说明项目解决的问题、核心能力、适用场景和主要技术栈，必须是完整句子，不能在句中截断。`
// 🔰 获取默认偏好设置（新用户首次访问时的兜底值）
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

// 🔰 合并用户偏好的部分值到默认值，缺失字段用默认值补齐
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
