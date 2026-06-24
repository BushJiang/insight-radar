// 用户偏好默认值：推荐/简介提示词模板、normalizePreference 合并用户值到默认值兜底。设置页和 API 路由共用
import type { UserPreference } from '@/types/insight-radar'

// 用户偏好存在 localStorage 中的 key
export const preferenceStorageKey = 'insight-radar-user-preference'
// 推荐提示词的默认模板，用户可在 /settings 页面修改。{{}} 内的变量运行时替换为真实值
export const defaultRecommendationAgentPrompt = `请根据领域偏好{{domainPreferences}}和用户需求{{query}}，为项目{{projectFullName}}写推荐说明。项目简介：{{projectSummary}}，语言：{{projectLanguage}}，成熟度：{{maturity}}，Stars：{{stars}}，来源：{{sourceGithubUsername}}。`
// 项目简介生成的默认提示词模板
export const defaultProjectProfileAgentPrompt = `请根据项目名称{{projectName}}、仓库全名{{repositoryFullName}}、项目描述{{projectDescription}}、主要语言{{primaryLanguage}}和 README 文档{{readme}}，生成不超过 200 字的中文项目简介。简介需要说明项目解决的问题、核心能力、适用场景和主要技术栈，必须是完整句子，不能在句中截断。`
// 项目分析的默认提示词模板
// 评分框架在分析智能体的 instructions 中，此处仅提供可编辑的变量模板
// {{candidateProjects}} 替换为候选项目列表，{{userQuery}} 替换为项目需求，{{domainPreferences}} 替换为领域偏好，{{recommendationLimit}} 替换为推荐数量
export const defaultProjectAnalysisAgentPrompt = `请根据项目分析规则对以下候选项目逐一评分，选出最适合推荐的 {{recommendationLimit}} 个项目。

用户需求：{{userQuery}}
领域偏好：{{domainPreferences}}

候选项目列表：
{{candidateProjects}}`
// 获取默认偏好设置（新用户首次访问时的兜底值）
export function getDefaultPreference(): UserPreference {
  return {
    id: 'pref-default',
    domains: [],
    recommendationAgentPrompt: defaultRecommendationAgentPrompt,
    projectAnalysisAgentPrompt: defaultProjectAnalysisAgentPrompt,
    projectProfileAgentPrompt: defaultProjectProfileAgentPrompt,
    candidateMultiplier: 4,
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
    projectAnalysisAgentPrompt: preference?.projectAnalysisAgentPrompt || defaultPreference.projectAnalysisAgentPrompt,
    projectProfileAgentPrompt: preference?.projectProfileAgentPrompt || defaultPreference.projectProfileAgentPrompt,
    candidateMultiplier: [2, 4, 8, 16].includes(Number(preference?.candidateMultiplier)) ? Number(preference?.candidateMultiplier) : defaultPreference.candidateMultiplier,
  }
}
