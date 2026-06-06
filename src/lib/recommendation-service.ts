import { z } from 'zod'
import { mastra } from '@/mastra'
import { getProjectMapByRepositoryIds, listProjectsForRecommendation } from '@/lib/projects-repository'
import { buildProfileHash, getProjectProfileStatus } from '@/lib/project-profile-service'
import { searchProjectProfileVectors, upsertProjectProfileVectors } from '@/lib/project-vector-store'
import type { GithubProject, ProjectSearchFilters, RecommendationExplanation, UserPreference } from '@/types/insight-radar'

interface GenerateRecommendationsOptions {
  query: string
  filters: ProjectSearchFilters
  recommendationLimit: number
  preference: UserPreference
}

const recommendationSchema = z.object({
  recommendations: z.array(z.object({
    repositoryId: z.string(),
    reason: z.string(),
  })),
  facts: z.array(z.string()),
  inferences: z.array(z.string()),
  suggestions: z.array(z.string()),
  confidence: z.enum(['high', 'medium', 'low']),
})

export async function generateProjectRecommendations({ query, filters, recommendationLimit, preference }: GenerateRecommendationsOptions) {
  const progress = await getProjectProfileStatus(filters)

  if (progress.status !== 'ready') {
    return {
      progress,
      recommendation: null,
      projects: [],
    }
  }

  const candidateProjectCount = Math.max(recommendationLimit, preference.candidateProjectCount)
  const candidateProjects = await getCandidateProjects(query, filters, candidateProjectCount)
  const agent = mastra.getAgent('projectRecommendationAgent')
  const result = await agent.generate(buildRecommendationPrompt({ query, preference, recommendationLimit, candidateProjects }), {
    structuredOutput: {
      schema: recommendationSchema,
      jsonPromptInjection: true,
    },
    modelSettings: {
      maxOutputTokens: 1600,
      temperature: 0.2,
    },
  })
  const selectedIds = result.object.recommendations
    .map((recommendation) => recommendation.repositoryId)
    .filter((repositoryId) => candidateProjects.some((project) => project.repositoryId === repositoryId))
    .slice(0, recommendationLimit)
  const fallbackIds = candidateProjects.map((project) => project.repositoryId).filter((repositoryId) => !selectedIds.includes(repositoryId))
  const projectIds = [...selectedIds, ...fallbackIds].slice(0, recommendationLimit)
  const recommendation: RecommendationExplanation = {
    id: `rec-${Date.now()}`,
    projectIds,
    query,
    facts: result.object.facts,
    inferences: result.object.inferences,
    suggestions: result.object.suggestions,
    sources: candidateProjects.filter((project) => projectIds.includes(project.repositoryId)).map((project) => project.sourceUrl),
    confidence: result.object.confidence,
    createdAt: new Date().toISOString(),
  }

  return {
    progress,
    recommendation,
    projects: candidateProjects,
  }
}

async function getCandidateProjects(query: string, filters: ProjectSearchFilters, limit: number) {
  const fallbackProjects = await listProjectsForRecommendation({ ...filters, limit })
  await upsertProjectProfileVectors(fallbackProjects)
  const vectorResults = await searchProjectProfileVectors({ query, filters, limit })

  if (vectorResults.length === 0) {
    return fallbackProjects
  }

  const projectMap = await getProjectMapByRepositoryIds(vectorResults.map((result) => result.repositoryId))
  const projects = vectorResults
    .map((result) => projectMap.get(result.repositoryId))
    .filter((project): project is GithubProject => Boolean(project))
    .filter((project) => buildProfileHash(project) === vectorResults.find((result) => result.repositoryId === project.repositoryId)?.profileHash)

  return projects.length > 0 ? projects : fallbackProjects
}

function buildRecommendationPrompt({ query, preference, recommendationLimit, candidateProjects }: { query: string; preference: UserPreference; recommendationLimit: number; candidateProjects: GithubProject[] }) {
  const domainsText = preference.domains.length > 0 ? preference.domains.join('、') : '无固定领域偏好'
  const candidatesText = candidateProjects.map((project, index) => [
    `候选项目 ${index + 1}`,
    `repositoryId：${project.repositoryId}`,
    `仓库：${project.fullName}`,
    `描述：${project.description}`,
    `项目简介：${project.readmeSummary ?? '暂无项目简介'}`,
    `语言：${project.language}`,
    `成熟度：${project.maturity}`,
    `Stars：${project.stars}`,
    `来源账号：${project.sourceGithubUsername}`,
    `链接：${project.sourceUrl}`,
  ].join('\n')).join('\n\n')

  return `${preference.recommendationAgentPrompt}

变量：
- 领域偏好：${domainsText}
- 项目需求：${query || '用户未填写具体需求，请基于领域偏好推荐。'}
- 最终推荐数量：${recommendationLimit}
- 候选项目数量：${candidateProjects.length}

候选项目：
${candidatesText}

请只从候选项目中选择最终推荐项目，返回 JSON。`
}
