import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import {
  buildGithubStarCollectionResult,
  collectGithubStarRepositoryData,
  persistGithubStarCollection,
  prepareGithubStarCollectionInput,
  prepareGithubStarProjectProfiles,
} from '@/lib/github-starred'

const projectMaturitySchema = z.enum(['early', 'growth', 'mature', 'stalled'])

const projectSearchFiltersSchema = z.object({
  query: z.string(),
  languages: z.array(z.string()),
  maturity: z.array(projectMaturitySchema),
  sourceGithubUsername: z.string().nullable(),
  days: z.number().nullable(),
})

const userPreferenceSchema = z.object({
  id: z.string(),
  domains: z.array(z.string()),
  recommendationAgentPrompt: z.string(),
  projectProfileAgentPrompt: z.string(),
  candidateMultiplier: z.number(),
  profileConcurrency: z.number(),
  analysisConcurrency: z.number(),
  reasonConcurrency: z.number(),
  updatedAt: z.string(),
})

const graphqlStarredEdgeSchema = z.object({
  starredAt: z.string(),
  node: z.object({
    databaseId: z.number(),
    name: z.string(),
    nameWithOwner: z.string(),
    description: z.string().nullable(),
    url: z.string(),
    stargazerCount: z.number(),
    forkCount: z.number(),
    primaryLanguage: z.object({ name: z.string() }).nullable(),
    licenseInfo: z.object({ spdxId: z.string().nullable(), name: z.string().nullable() }).nullable(),
    repositoryTopics: z.object({
      nodes: z.array(z.object({
        topic: z.object({ name: z.string() }).passthrough(),
      }).passthrough()),
    }).passthrough(),
    isFork: z.boolean(),
    parent: z.object({ nameWithOwner: z.string(), url: z.string() }).passthrough().nullable(),
    defaultBranchRef: z.object({ name: z.string() }).passthrough().nullable(),
    updatedAt: z.string(),
    pushedAt: z.string().nullable(),
    issues: z.object({ totalCount: z.number() }).passthrough(),
  }).passthrough(),
}).passthrough()

const githubProjectSchema = z.object({
  id: z.string().optional(),
  repositoryId: z.string(),
  fullName: z.string(),
  name: z.string(),
  description: z.string(),
  language: z.string(),
  stars: z.number(),
  forks: z.number(),
  issues: z.number(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  pushedAt: z.string().nullable(),
  projectSummary: z.string().nullable(),
  readmeContent: z.string().nullable(),
  readmeHash: z.string().nullable(),
  topics: z.array(z.string()),
  license: z.string().nullable(),
  isFork: z.boolean(),
  sourceRepositoryFullName: z.string().nullable(),
  sourceRepositoryUrl: z.string().nullable(),
  sourceGithubUsername: z.string(),
  githubUpdatedAt: z.string().optional(),
  starAt: z.string(),
  sourceUrl: z.string(),
  matchReason: z.string(),
  maturity: projectMaturitySchema,
  collectionJobId: z.string(),
}).passthrough()

const persistProjectsResultSchema = z.object({
  createdProjects: z.array(githubProjectSchema),
  duplicateCount: z.number(),
  updatedDuplicateCount: z.number(),
  unchangedDuplicateCount: z.number(),
})

const githubStarCollectionInputSchema = z.object({
  filters: projectSearchFiltersSchema,
  githubToken: z.string().optional(),
  maxProjects: z.number().int().min(0).optional(),
  preference: userPreferenceSchema.partial().optional(),
})

const githubStarCollectionPreparedSchema = githubStarCollectionInputSchema.extend({
  username: z.string(),
  normalizedPreference: userPreferenceSchema,
})

const githubStarCollectionRepositoryDataSchema = githubStarCollectionPreparedSchema.extend({
  edges: z.array(graphqlStarredEdgeSchema),
  totalCount: z.number().nullable(),
})

const githubStarCollectionPersistedSchema = githubStarCollectionRepositoryDataSchema.extend({
  collectedProjects: z.array(githubProjectSchema),
  persistedResult: persistProjectsResultSchema,
})

const githubStarCollectionResultSchema = z.object({
  projects: z.array(githubProjectSchema),
  totalCount: z.number(),
  fetchedCount: z.number(),
  duplicateCount: z.number(),
  updatedDuplicateCount: z.number(),
  unchangedDuplicateCount: z.number(),
  estimatedTotalCount: z.number().nullable(),
  rateLimitRemaining: z.string().nullable(),
  rateLimitResetAt: z.string().nullable(),
  error: z.string().nullable(),
})

// 准备阶段：把请求参数整理成后续步骤都能直接使用的稳定输入
const prepareRequestStep = createStep({
  id: 'prepareRequest',
  description: '归一化采集请求',
  inputSchema: githubStarCollectionInputSchema,
  outputSchema: githubStarCollectionPreparedSchema,
  execute: async ({ inputData }) => prepareGithubStarCollectionInput(inputData),
})

// 采集阶段：统一封装 GitHub Star 列表和 README 获取，调用方只理解“获取仓库数据”
const collectRepositoryDataStep = createStep({
  id: 'collectRepositoryData',
  description: '获取 GitHub 仓库数据',
  inputSchema: githubStarCollectionPreparedSchema,
  outputSchema: githubStarCollectionRepositoryDataSchema,
  execute: async ({ inputData, writer }) => {
    await writer?.write({ type: 'progress', step: 'fetch_stars' })
    return collectGithubStarRepositoryData(inputData)
  },
})

// 持久化阶段：统一封装字段映射、成熟度推断、去重写库和统计值
const persistProjectsStep = createStep({
  id: 'persistProjects',
  description: '保存采集项目',
  inputSchema: githubStarCollectionRepositoryDataSchema,
  outputSchema: githubStarCollectionPersistedSchema,
  execute: async ({ inputData, writer }) => {
    const reportProgress = async (step: string) => {
      await writer?.write({ type: 'progress', step })
    }

    return persistGithubStarCollection(inputData, reportProgress)
  },
})

// 画像阶段：采集后只补齐简介，向量同步交给后续项目画像准备流程
const prepareProjectProfilesStep = createStep({
  id: 'prepareProjectProfiles',
  description: '生成缺失项目简介',
  inputSchema: githubStarCollectionPersistedSchema,
  outputSchema: githubStarCollectionPersistedSchema,
  execute: async ({ inputData, writer }) => {
    const reportProgress = async (step: string) => {
      await writer?.write({ type: 'progress', step })
    }

    return prepareGithubStarProjectProfiles(inputData, reportProgress)
  },
})

// 结果阶段：把内部采集状态整理回前端已经使用的响应结构
const buildCollectionResultStep = createStep({
  id: 'buildCollectionResult',
  description: '组装采集结果',
  inputSchema: githubStarCollectionPersistedSchema,
  outputSchema: githubStarCollectionResultSchema,
  execute: async ({ inputData }) => buildGithubStarCollectionResult(inputData),
})

export const githubStarCollectionWorkflow = createWorkflow({
  id: 'github-star-collection-workflow',
  description: 'GitHub Star 项目采集工作流：获取仓库、保存项目、生成简介、返回结果',
  inputSchema: githubStarCollectionInputSchema,
  outputSchema: githubStarCollectionResultSchema,
})
  .then(prepareRequestStep)
  .then(collectRepositoryDataStep)
  .then(persistProjectsStep)
  .then(prepareProjectProfilesStep)
  .then(buildCollectionResultStep)
  .commit()
