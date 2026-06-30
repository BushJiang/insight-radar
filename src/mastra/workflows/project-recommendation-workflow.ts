import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import {
  analyzeRecommendationCandidates,
  buildRecommendationResult,
  ensureRecommendationReadiness,
  generateRecommendationReasonMap,
  searchRecommendationCandidates,
} from '@/lib/recommendation-service'
import type { GithubProject, ProjectRecommendationReason, RecommendationExplanation } from '@/types/insight-radar'

const recommendationProgressSchema = z.object({
  status: z.enum(['ready', 'running', 'failed']),
  completedCount: z.number(),
  totalCount: z.number(),
  message: z.string().nullable(),
})

const preferenceSchema = z.object({
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

const filtersSchema = z.object({
  query: z.string(),
  languages: z.array(z.string()),
  maturity: z.array(z.enum(['early', 'growth', 'mature', 'stalled'])),
  sourceGithubUsername: z.string().nullable(),
  days: z.number().nullable(),
})

const recommendationWorkflowInputSchema = z.object({
  query: z.string(),
  filters: filtersSchema,
  recommendationLimit: z.number().int().min(1).max(50),
  preference: preferenceSchema,
})

const githubProjectSchema = z.custom<GithubProject>()
const projectRecommendationReasonSchema = z.custom<ProjectRecommendationReason>()
const recommendationExplanationSchema = z.custom<RecommendationExplanation>()
const analysisResultSchema = z.object({
  repositoryId: z.string(),
  fullName: z.string(),
  totalScore: z.number(),
  scores: z.record(z.string(), z.number()),
  analysisReason: z.string(),
})

const recommendationWorkflowOutputSchema = z.object({
  progress: recommendationProgressSchema,
  recommendation: recommendationExplanationSchema.nullable(),
  projects: z.array(githubProjectSchema),
})

const recommendationCandidateSearchSchema = recommendationWorkflowInputSchema.extend({
  progress: recommendationProgressSchema,
  candidateProjects: z.array(githubProjectSchema),
})

type RecommendationCandidateSearchSchemaOutput = z.infer<typeof recommendationCandidateSearchSchema>
type RecommendationAnalysisSchemaOutput = RecommendationCandidateSearchSchemaOutput & {
  analysisResults: Array<{
    repositoryId: string
    fullName: string
    totalScore: number
    scores: Record<string, number>
    analysisReason: string
  }>
  selectedProjects: z.infer<typeof githubProjectSchema>[]
}
type RecommendationReasonSchemaOutput = RecommendationAnalysisSchemaOutput & {
  reasons: Record<string, ProjectRecommendationReason>
}

function toGithubProjects(projects: z.infer<typeof githubProjectSchema>[]): GithubProject[] {
  return projects as GithubProject[]
}

function toAnalysisServiceInput(inputData: RecommendationAnalysisSchemaOutput) {
  return {
    ...inputData,
    candidateProjects: toGithubProjects(inputData.candidateProjects),
    selectedProjects: toGithubProjects(inputData.selectedProjects),
    analysisResults: inputData.analysisResults.map((result) => ({ ...result, repositoryId: String(result.repositoryId) })),
  }
}

function toRecommendationServiceInput(inputData: RecommendationReasonSchemaOutput) {
  return {
    ...toAnalysisServiceInput(inputData),
    reasons: inputData.reasons,
  }
}

function toRecommendationOutput(output: { progress: z.infer<typeof recommendationProgressSchema>; recommendation: RecommendationExplanation | null; projects: GithubProject[] }) {
  return output as z.infer<typeof recommendationWorkflowOutputSchema>
}

const recommendationAnalysisSchema = recommendationCandidateSearchSchema.extend({
  analysisResults: z.array(analysisResultSchema),
  selectedProjects: z.array(githubProjectSchema),
})

const recommendationReasonSchema = recommendationAnalysisSchema.extend({
  reasons: z.record(z.string(), projectRecommendationReasonSchema),
})

// 准备阶段：补齐项目简介并同步向量，保证后续搜索有稳定输入
const readinessStep = createStep({
  id: 'readiness',
  description: '确保推荐所需的数据已准备完成',
  inputSchema: recommendationWorkflowInputSchema,
  outputSchema: z.object({
    progress: recommendationProgressSchema,
    query: z.string(),
    filters: filtersSchema,
    recommendationLimit: z.number().int().min(1).max(50),
    preference: preferenceSchema,
    ready: z.boolean(),
  }),
  execute: async ({ inputData, writer }) => {
    await writer?.write({ type: 'progress', step: 'readiness' })
    const readiness = await ensureRecommendationReadiness(inputData.filters, inputData.preference)

    return {
      progress: readiness.progress,
      query: inputData.query,
      filters: inputData.filters,
      recommendationLimit: inputData.recommendationLimit,
      preference: inputData.preference,
      ready: readiness.progress.status === 'ready',
    }
  },
})

// 推荐阶段 1：只负责拿到候选项目，不做打分和解释
const searchStep = createStep({
  id: 'search',
  description: '检索候选项目',
  inputSchema: z.object({
    progress: recommendationProgressSchema,
    query: z.string(),
    filters: filtersSchema,
    recommendationLimit: z.number().int().min(1).max(50),
    preference: preferenceSchema,
    ready: z.boolean(),
  }),
  outputSchema: recommendationCandidateSearchSchema,
  execute: async ({ inputData, writer }) => {
    if (!inputData.ready) {
      return {
        query: inputData.query,
        filters: inputData.filters,
        recommendationLimit: inputData.recommendationLimit,
        preference: inputData.preference,
        progress: inputData.progress,
        candidateProjects: [],
      }
    }

    await writer?.write({ type: 'progress', step: 'search' })

    return searchRecommendationCandidates({
      query: inputData.query,
      filters: inputData.filters,
      recommendationLimit: inputData.recommendationLimit,
      preference: inputData.preference,
      progress: inputData.progress,
    })
  },
})

// 推荐阶段 2：只负责让分析智能体对候选项目评分排序；数据未就绪时保留空结果继续交给 result 统一返回
const analysisStep = createStep({
  id: 'analysis',
  description: '分析候选项目并选择入选项目',
  inputSchema: recommendationCandidateSearchSchema,
  outputSchema: recommendationAnalysisSchema,
  execute: async ({ inputData, writer }) => {
    if (inputData.progress.status !== 'ready') {
      return { ...inputData, analysisResults: [], selectedProjects: [] }
    }

    await writer?.write({ type: 'progress', step: 'analysis' })

    return analyzeRecommendationCandidates({
      ...inputData,
      candidateProjects: toGithubProjects(inputData.candidateProjects),
    })
  },
})

// 推荐阶段 3：只负责让推荐智能体为入选项目生成面向用户的解释
const reasonsStep = createStep({
  id: 'reasons',
  description: '生成推荐理由',
  inputSchema: recommendationAnalysisSchema,
  outputSchema: recommendationReasonSchema,
  execute: async ({ inputData, writer }) => {
    if (inputData.progress.status !== 'ready') {
      return { ...inputData, reasons: {} }
    }

    await writer?.write({ type: 'progress', step: 'reasons' })

    return generateRecommendationReasonMap(toAnalysisServiceInput(inputData))
  },
})

// 结果阶段：把前面阶段的候选、评分、理由组装成前端展示结构
const resultStep = createStep({
  id: 'result',
  description: '组装推荐结果',
  inputSchema: recommendationReasonSchema,
  outputSchema: recommendationWorkflowOutputSchema,
  execute: async ({ inputData }) => toRecommendationOutput(buildRecommendationResult(toRecommendationServiceInput(inputData as RecommendationReasonSchemaOutput))),
})

// 推荐工作流：把准备、检索、分析和解释拆成可追踪的阶段，方便阅读和调试
export const projectRecommendationWorkflow = createWorkflow({
  id: 'project-recommendation-workflow',
  description: '智能推荐工作流：准备数据、检索候选、分析排序、生成理由',
  inputSchema: recommendationWorkflowInputSchema,
  outputSchema: recommendationWorkflowOutputSchema,
})
  .then(readinessStep)
  .then(searchStep)
  .then(analysisStep)
  .then(reasonsStep)
  .then(resultStep)
  .commit()
