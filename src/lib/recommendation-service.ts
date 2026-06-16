// 🔰 智能推荐服务：从 PostgreSQL + Milvus 向量搜索候选项目 → Mastra Agent 逐项目生成推荐理由
import { mastra } from '@/mastra'
import { getProjectMapByRepositoryIds, listProjectsForRecommendation } from '@/lib/projects-repository'
import { buildProfileHash, getProjectProfileStatus } from '@/lib/project-profile-service'
import { searchProjectProfileVectors, upsertProjectProfileVectors } from '@/lib/project-vector-store'
import type { GithubProject, ProjectSearchFilters, RecommendationExplanation, UserPreference } from '@/types/insight-radar'

// 🔰 AI 生成的推荐理由最长 280 字符
const recommendationReasonMaxLength = 280

interface GenerateRecommendationsOptions {
  query: string
  filters: ProjectSearchFilters
  recommendationLimit: number
  preference: UserPreference
}

// 🔰 生成推荐的主入口。先确保有简介 → 向量搜索候选项目 → AI 生成推荐理由
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
  const selectedProjects = candidateProjects.slice(0, recommendationLimit)
  const projectIds = selectedProjects.map((project) => project.repositoryId)
  const reasons = await generateRecommendationReasons({ query, preference, recommendationLimit, candidateProjects: selectedProjects })
  const recommendation: RecommendationExplanation = {
    id: `rec-${Date.now()}`,
    projectIds,
    query,
    reasons,
    facts: buildRecommendationFacts(selectedProjects),
    inferences: buildRecommendationInferences(query, selectedProjects),
    suggestions: buildRecommendationSuggestions(selectedProjects),
    sources: selectedProjects.map((project) => project.sourceUrl),
    confidence: selectedProjects.length >= recommendationLimit ? 'medium' : 'low',
    createdAt: new Date().toISOString(),
  }

  return {
    progress,
    recommendation,
    projects: candidateProjects,
  }
}

// 🔰 从数据库 + 向量搜索获取候选项目，向量搜索无结果时回退到数据库列表
async function getCandidateProjects(query: string, filters: ProjectSearchFilters, limit: number) {
  const fallbackProjects = await listProjectsForRecommendation({ ...filters, limit })
// 🔰 将项目简介向量化后写入 Milvus，用于语义搜索
  await upsertProjectProfileVectors(fallbackProjects)
// 🔰 在 Milvus 中搜索语义相似的项目，结合 COSINE 相似度排序
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

// 🔰 对每个候选项目调用 Mastra Agent 并发生成推荐理由
async function generateRecommendationReasons({ query, preference, recommendationLimit, candidateProjects }: { query: string; preference: UserPreference; recommendationLimit: number; candidateProjects: GithubProject[] }) {
  if (candidateProjects.length === 0) {
    return {}
  }

  try {
    const agent = mastra.getAgent('projectRecommendationAgent')
    const reasonEntries = await Promise.all(candidateProjects.map(async (project) => {
      const result = await agent.generate(buildRecommendationReasonPrompt({ query, preference, recommendationLimit, project }), {
        modelSettings: {
          maxOutputTokens: 320,
          temperature: 0.2,
        },
      })
      const reason = normalizeRecommendationReason(result.text, project, query)

      return [project.repositoryId, reason] as const
    }))

    return Object.fromEntries(reasonEntries)
  } catch {
    return Object.fromEntries(candidateProjects.map((project) => [project.repositoryId, buildFallbackRecommendationReason(project, query)]))
  }
}

// 🔰 AI 返回空或失败时，用项目信息拼接兜底理由
function normalizeRecommendationReason(text: string | undefined, project: GithubProject, query: string) {
  const reason = text?.trim()

  return reason ? sanitizeRecommendationReason(reason) : buildFallbackRecommendationReason(project, query)
}

function buildFallbackRecommendationReason(project: GithubProject, query: string) {
  const demandText = query || '当前项目需求'
  const profile = project.projectSummary ?? project.description

  return sanitizeRecommendationReason(`${project.fullName} 适合“${demandText}”。${profile}`)
}

// 🔰 清理 AI 输出中的 Markdown 格式（标题、粗体、代码块、列表标记）
function sanitizeRecommendationReason(reason: string) {
  return reason
    .replace(/#{1,6}\s*/g, '')
    .replace(/\*\*/g, '')
    .replace(/```/g, '')
    .replace(/^[-*]\s+/gm, '')
    .trim()
    .slice(0, recommendationReasonMaxLength)
}

function buildRecommendationReasonPrompt({ query, preference, recommendationLimit, project }: { query: string; preference: UserPreference; recommendationLimit: number; project: GithubProject }) {
  const domainsText = preference.domains.length > 0 ? preference.domains.join('、') : '无固定领域偏好'
  const variables: Record<string, string> = {
    domainPreferences: domainsText,
    query: query || '用户未填写具体需求，请基于领域偏好推荐。',
    projectFullName: project.fullName,
    projectSummary: project.projectSummary ?? '暂无项目简介',
    projectLanguage: project.language,
    maturity: project.maturity,
    stars: String(project.stars),
    sourceGithubUsername: project.sourceGithubUsername,
  }
  let userPrompt = preference.recommendationAgentPrompt
  for (const [key, value] of Object.entries(variables)) {
    userPrompt = userPrompt.replaceAll(`{{${key}}}`, value)
  }

  return `${userPrompt}

项目数据：
仓库：${project.fullName}
描述：${project.description}
项目简介：${project.projectSummary ?? '暂无项目简介'}
语言：${project.language}
成熟度：${project.maturity}
Stars：${project.stars}
来源账号：${project.sourceGithubUsername}
链接：${project.sourceUrl}
推荐数量：${recommendationLimit} 个项目中选 1 个

请只输出这个项目的推荐理由，不要返回 JSON，不要使用 Markdown，不要输出 ##、**、列表符号或代码块。每个字段之间必须用换行分隔。输出内容不超过 200 字，严格按照以下格式输出：
推荐理由：
适用场景：
上手建议：
风险提醒：`
}

function buildRecommendationFacts(projects: GithubProject[]) {
  return projects.map((project) => `${project.fullName}：${project.language}，${project.stars} Stars，来源账号 ${project.sourceGithubUsername}。`)
}

function buildRecommendationInferences(query: string, projects: GithubProject[]) {
  if (projects.length === 0) {
    return ['当前筛选条件下没有候选项目。']
  }

  return projects.map((project) => `${project.fullName} 与“${query || '当前需求'}”的匹配主要来自项目简介、语言和项目活跃度。`)
}

function buildRecommendationSuggestions(projects: GithubProject[]) {
  if (projects.length === 0) {
    return ['放宽来源账号、语言、成熟度或时间范围筛选后重新推荐。']
  }

  return projects.map((project) => `先阅读 ${project.fullName} 的 README、许可证和最近提交，再决定是否深入使用。`)
}

