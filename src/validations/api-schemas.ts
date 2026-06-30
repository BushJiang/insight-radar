// API 校验 Schema：Zod 定义搜索/采集/推荐请求体验证规则，所有 API 路由共用
import { z } from 'zod'

export const projectMaturityEnum = z.enum(['early', 'growth', 'mature', 'stalled'])

export const projectSearchFiltersSchema = z.object({
  query: z.string().default(''),
  languages: z.array(z.string()).default([]),
  maturity: z.array(projectMaturityEnum).default([]),
  sourceGithubUsername: z.string().nullable().default(null),
  days: z.number().nullable().default(null),
})

export const searchProjectsSchema = z.object({
  filters: projectSearchFiltersSchema,
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
})

export const userPreferenceSchema = z.object({
  id: z.string(),
  domains: z.array(z.string()).default([]),
  recommendationAgentPrompt: z.string().default(''),
  projectProfileAgentPrompt: z.string().default(''),
  candidateMultiplier: z.number().int().refine((value) => [2, 4, 8, 16].includes(value), { message: '候选池倍数必须是 2、4、8 或 16' }).default(4),
  profileConcurrency: z.number().int().refine((value) => [10, 20, 40, 80, 160, 320].includes(value), { message: '简介生成并发数必须是 10、20、40、80、160 或 320' }).default(20),
  analysisConcurrency: z.number().int().refine((value) => [2, 4, 8, 16].includes(value), { message: '分析评分并发数必须是 2、4、8 或 16' }).default(2),
  reasonConcurrency: z.number().int().refine((value) => [2, 4, 8, 16].includes(value), { message: '推荐理由并发数必须是 2、4、8 或 16' }).default(2),
  updatedAt: z.string(),
})

export const userApiKeysSchema = z.object({
  githubToken: z.string().optional(),
  deepseekApiKey: z.string().optional(),
  siliconFlowApiKey: z.string().optional(),
})

export const appSettingsSchema = z.object({
  preference: userPreferenceSchema.partial().optional(),
  apiKeys: userApiKeysSchema.partial().optional(),
})

export const githubStarredSearchSchema = z.object({
  filters: projectSearchFiltersSchema,
  maxProjects: z.number().int().min(0).optional(),
  preference: userPreferenceSchema.partial().optional(),
})

export const recommendationRequestSchema = z.object({
  query: z.string(),
  filters: projectSearchFiltersSchema,
  recommendationLimit: z.number().int().min(1).max(50).default(4),
  preference: userPreferenceSchema.partial().optional(),
})
