// 智能推荐服务：Milvus 向量搜索候选 → AI 分析评分筛选 → AI 逐项目生成推荐理由
import { mastra } from '@/mastra'
import { getProjectMapByRepositoryIds } from '@/lib/projects-repository'
import { buildProfileHash } from '@/lib/project-profile-hash'
import { getProjectProfileStatus } from '@/lib/project-profile-service'
import { searchProjectProfileVectors } from '@/lib/project-vector-store'
import { truncateText } from '@/lib/utils'
import type { GithubProject, ProjectSearchFilters, RecommendationExplanation, UserPreference } from '@/types/insight-radar'

const recommendationReasonMaxLength = 280
const maxProjectsPerAnalysisBatch = 20

interface AnalysisResult {
  repositoryId: string
  fullName: string
  totalScore: number
  scores: Record<string, number>
  analysisReason: string
}

interface GenerateRecommendationsOptions {
  query: string
  filters: ProjectSearchFilters
  recommendationLimit: number
  preference: UserPreference
}

// 生成推荐的主入口：简介检查 → 向量搜索 → AI 分析评分筛选 → AI 生成推荐理由
export async function generateProjectRecommendations({ query, filters, recommendationLimit, preference }: GenerateRecommendationsOptions) {
  console.log(`[recommendation] 🔍 收到推荐请求: "${query}"`)
  const progress = await getProjectProfileStatus(filters)

  if (progress.status !== 'ready') {
    console.log(`[recommendation] ⚠️ 项目简介未就绪 (${progress.completedCount}/${progress.totalCount})，中止推荐`)
    return { progress, recommendation: null, projects: [] }
  }

  console.log(`[recommendation] 📊 项目简介就绪 (${progress.completedCount}/${progress.totalCount})`)
  const candidateProjectCount = Math.max(1, Math.min(recommendationLimit * preference.candidateMultiplier, 50))
  console.log(`[recommendation] 🔎 开始向量搜索，候选数: ${candidateProjectCount} (推荐 ${recommendationLimit} × ${preference.candidateMultiplier} 倍)`)
  const candidateProjects = await getCandidateProjects(query, filters, candidateProjectCount)
  console.log(`[recommendation] 🎯 向量搜索返回 ${candidateProjects.length} 个候选项目`)

  if (candidateProjects.length === 0) {
    console.log(`[recommendation] ⚠️ 无候选项目，结束推荐`)
    const recommendation: RecommendationExplanation = {
      id: `rec-${Date.now()}`,
      projectIds: [],
      query,
      reasons: {},
      scores: {},
      facts: [],
      inferences: buildRecommendationInferences(query, []),
      suggestions: buildRecommendationSuggestions([]),
      sources: [],
      confidence: 'low',
      createdAt: new Date().toISOString(),
    }
    return { progress, recommendation, projects: [] }
  }

  // AI 分析评分：从候选项目中筛选出最值得推荐的 N 个项目
  console.log(`[recommendation] 📊 正在分析 ${candidateProjects.length} 个候选项目...`)
  let analysisResults: AnalysisResult[]

  try {
    analysisResults = await analyzeCandidateProjects(candidateProjects, query, preference, recommendationLimit)
    console.log(`[recommendation] 📊 分析完成: ${analysisResults.length} 个项目入选`)
  } catch (error) {
    console.error('[recommendation] 项目分析失败，回退到向量相似度排序:', error instanceof Error ? error.message : String(error))
    // 分析失败时回退到向量相似度排序
    analysisResults = candidateProjects.slice(0, recommendationLimit).map((project) => ({
      repositoryId: project.repositoryId,
      fullName: project.fullName,
      totalScore: 0,
      scores: {},
      analysisReason: '分析失败，使用默认排序。',
    }))
  }

  // 按分析得分顺序排列入选项目（LLM 返回的 repositoryId 可能是数字，统一转字符串比较）
  const selectedProjects = analysisResults
    .map((result) => candidateProjects.find((project) => String(project.repositoryId) === String(result.repositoryId)))
    .filter((project): project is GithubProject => Boolean(project))
  const projectIds = selectedProjects.map((project) => project.repositoryId)

  // 生成推荐理由
  console.log(`[recommendation] 🤖 正在为 ${selectedProjects.length} 个项目生成推荐理由...`)
  const reasons = await generateRecommendationReasons({ query, preference, recommendationLimit, candidateProjects: selectedProjects })
  console.log(`[recommendation] 📝 推荐理由生成完成 (${Object.keys(reasons).length} 条)`)

  // 组装评分数据，repositoryId → ProjectScore
  const scores: Record<string, { totalScore: number; dimensions: Record<string, number>; analysisReason: string }> = {}
  for (const result of analysisResults) {
    scores[String(result.repositoryId)] = {
      totalScore: result.totalScore,
      dimensions: result.scores,
      analysisReason: result.analysisReason,
    }
  }

  const scoreInferences = analysisResults.map((result) =>
    `${result.fullName} 分析得分 ${result.totalScore.toFixed(1)}/5.0：${result.analysisReason}`,
  )

  const recommendation: RecommendationExplanation = {
    id: `rec-${Date.now()}`,
    projectIds,
    query,
    reasons,
    scores,
    facts: buildRecommendationFacts(selectedProjects),
    inferences: scoreInferences.length > 0 ? scoreInferences : buildRecommendationInferences(query, selectedProjects),
    suggestions: buildRecommendationSuggestions(selectedProjects),
    sources: selectedProjects.map((project) => project.sourceUrl),
    confidence: selectedProjects.length >= recommendationLimit ? 'medium' : 'low',
    createdAt: new Date().toISOString(),
  }

  console.log(`[recommendation] ✅ 推荐完成 (${projectIds.length} 个入选项目, 置信度: ${recommendation.confidence})`)
  return { progress, recommendation, projects: candidateProjects }
}

// analyzeCandidateProjects 对候选项目进行 AI 分析评分，支持分批处理（每批最多 20 个），最后汇总取总分最高的 limit 个
async function analyzeCandidateProjects(candidates: GithubProject[], query: string, preference: UserPreference, limit: number): Promise<AnalysisResult[]> {
  // 单批：直接分析全部
  if (candidates.length <= maxProjectsPerAnalysisBatch) {
    return analyzeCandidateBatch(candidates, query, preference, limit)
  }

  // 分批：每批各自筛选，汇总后取全局 top N
  const batches: GithubProject[][] = []
  for (let index = 0; index < candidates.length; index += maxProjectsPerAnalysisBatch) {
    batches.push(candidates.slice(index, index + maxProjectsPerAnalysisBatch))
  }

  console.log(`[recommendation] 📊 候选项目超过 ${maxProjectsPerAnalysisBatch} 个，分 ${batches.length} 批分析`)
  const batchResults = await Promise.all(batches.map((batch) => analyzeCandidateBatch(batch, query, preference, limit)))

  const allResults = batchResults.flat()
  allResults.sort((left, right) => right.totalScore - left.totalScore)

  return allResults.slice(0, limit)
}

// analyzeCandidateBatch 对一批候选项目调用分析智能体进行评分
async function analyzeCandidateBatch(candidates: GithubProject[], query: string, preference: UserPreference, selectCount: number): Promise<AnalysisResult[]> {
  const agent = mastra.getAgent('projectAnalysisAgent')
  const userPrompt = buildAnalysisPrompt(candidates, query, preference, selectCount)

  const result = await agent.generate(userPrompt, {
    modelSettings: {
      maxOutputTokens: 8192,
    },
  })

  const rawText = result.text ?? ''
  console.log(`[recommendation] 📊 智能体分析原始输出:\n${rawText}`)
  const jsonText = extractJson(rawText)

  try {
    const parsed = JSON.parse(jsonText) as { selectedProjects?: AnalysisResult[] }

    if (!Array.isArray(parsed.selectedProjects) || parsed.selectedProjects.length === 0) {
      throw new Error('分析结果为空')
    }

    return parsed.selectedProjects
  } catch (error) {
    console.error('[recommendation] 分析结果解析失败:', error instanceof Error ? error.message : String(error))
    console.error('[recommendation] JSON 提取结果:', jsonText.slice(0, 300))
    console.error('[recommendation] 完整原始输出:', rawText)

    // 解析失败时回退到原始顺序
    return candidates.slice(0, selectCount).map((project) => ({
      repositoryId: project.repositoryId,
      fullName: project.fullName,
      totalScore: 0,
      scores: {},
      analysisReason: '评分解析失败。',
    }))
  }
}

// buildAnalysisPrompt 构造项目分析智能体的用户提示词
function buildAnalysisPrompt(candidates: GithubProject[], query: string, preference: UserPreference, selectCount: number): string {
  const domainsText = preference.domains.length > 0 ? preference.domains.join('、') : '无固定领域偏好'
  const candidateTexts = candidates.map((project, index) => buildProjectCard(project, index + 1))
  const variables: Record<string, string> = {
    candidateProjects: candidateTexts.join('\n\n'),
    userQuery: query || '用户未填写具体需求，请基于领域偏好和项目质量评分。',
    domainPreferences: domainsText,
    recommendationLimit: String(selectCount),
  }
  let userPrompt = preference.projectAnalysisAgentPrompt
  for (const [key, value] of Object.entries(variables)) {
    userPrompt = userPrompt.replaceAll(`{{${key}}}`, value)
  }

  return userPrompt
}

// buildProjectCard 将单个项目格式化为分析提示词中的一段紧凑文本
function buildProjectCard(project: GithubProject, index: number): string {
  const maturityLabel = { mature: '成熟期', growth: '成长期', early: '早期', stalled: '停滞期' }[project.maturity] ?? project.maturity
  const readmeExcerpt = project.readmeContent ? truncateText(project.readmeContent, 200) : '暂无 README'

  return [
    `${index}. ${project.fullName}`,
    `   ID: ${project.repositoryId}`,
    `   描述: ${project.description}`,
    `   简介: ${project.projectSummary ?? '暂无项目简介'}`,
    `   README 摘要: ${readmeExcerpt}`,
    `   语言: ${project.language}  Stars: ${project.stars}  成熟度: ${maturityLabel}`,
    `   标签: ${project.topics.length > 0 ? project.topics.slice(0, 8).join('、') : '无'}`,
    `   协议: ${project.license ?? '未声明'}  来源: ${project.sourceGithubUsername}`,
  ].join('\n')
}

// getCandidateProjects 执行 Milvus 向量搜索并用 profileHash 过滤过期结果
async function getCandidateProjects(query: string, filters: ProjectSearchFilters, limit: number) {
  const vectorResults = await searchProjectProfileVectors({ query, filters, limit })
  console.log(`[recommendation] 🔎 Milvus 向量搜索完成: ${vectorResults.length} 条命中`)

  if (vectorResults.length === 0) {
    console.log(`[recommendation] ⚠️ Milvus 无命中，可能原因: 向量库无数据 / 搜索返回空 / 调用异常`)
    return []
  }

  const freshResults = await resolveFreshVectorProjects(vectorResults)
  const staleCount = vectorResults.length - freshResults.length

  if (staleCount > 0) {
    console.log(`[recommendation] 🧹 过滤掉 ${staleCount} 条过期向量 (profileHash 不匹配)`)
  }

  return freshResults
}

async function resolveFreshVectorProjects(vectorResults: Array<{ repositoryId: string; profileHash: string }>) {
  if (vectorResults.length === 0) return []

  const repoIds = vectorResults.map((result) => result.repositoryId)
  const projectMap = await getProjectMapByRepositoryIds(repoIds)

  return vectorResults
    .map((result) => {
      const project = projectMap.get(result.repositoryId)
      if (!project) {
        console.log(`[recommendation] 🗑️  ${result.repositoryId}: PostgreSQL 中不存在或已删除`)
        return null
      }
      const currentHash = buildProfileHash(project)
      if (currentHash !== result.profileHash) {
        console.log(`[recommendation] 🗑️  ${result.repositoryId} (${project.fullName}): profileHash 不匹配, 向量已过期`)
        return null
      }
      return project
    })
    .filter((project): project is GithubProject => Boolean(project))
}

async function generateRecommendationReasons({ query, preference, recommendationLimit, candidateProjects }: { query: string; preference: UserPreference; recommendationLimit: number; candidateProjects: GithubProject[] }) {
  if (candidateProjects.length === 0) return {}

  try {
    const agent = mastra.getAgent('projectRecommendationAgent')
    const reasonEntries = await Promise.all(candidateProjects.map(async (project) => {
      const result = await agent.generate(buildRecommendationReasonPrompt({ query, preference, recommendationLimit, project }), {
        modelSettings: { maxOutputTokens: 320, temperature: 0.2 },
      })
      const reason = normalizeRecommendationReason(result.text, project, query)
      return [project.repositoryId, reason] as const
    }))
    return Object.fromEntries(reasonEntries)
  } catch {
    return Object.fromEntries(candidateProjects.map((project) => [project.repositoryId, buildFallbackRecommendationReason(project, query)]))
  }
}

function normalizeRecommendationReason(text: string | undefined, project: GithubProject, query: string) {
  const reason = text?.trim()
  return reason ? sanitizeRecommendationReason(reason) : buildFallbackRecommendationReason(project, query)
}

function buildFallbackRecommendationReason(project: GithubProject, query: string) {
  const profile = project.projectSummary ?? project.description
  return sanitizeRecommendationReason(`${project.fullName} 适合“${query || '当前项目需求'}”。${profile}`)
}

function sanitizeRecommendationReason(reason: string) {
  return reason.replace(/#{1,6}\s*/g, '').replace(/\*\*/g, '').replace(/```/g, '').replace(/^[-*]\s+/gm, '').trim().slice(0, recommendationReasonMaxLength)
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
  if (projects.length === 0) return ['当前筛选条件下没有候选项目。']
  return projects.map((project) => `${project.fullName} 与“${query || '当前需求'}”的匹配主要来自项目简介、语言和项目活跃度。`)
}

// 从 LLM 输出中提取 JSON——推理模型可能在 JSON 前后输出大量思考内容
// 从 LLM 输出中提取 JSON——推理模型可能在 JSON 前后输出大量思考内容
function extractJson(text: string): string {
  // 去掉 Markdown 代码块标记
  let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()

  // 优先按 "selectedProjects" 定位：找到它前面的 { 和对应的 }
  const markerIndex = cleaned.indexOf('"selectedProjects"')
  if (markerIndex !== -1) {
    const beforeMarker = cleaned.slice(0, markerIndex)
    const openBrace = beforeMarker.lastIndexOf('{')
    if (openBrace !== -1) {
      const closeBrace = findMatchingBrace(cleaned, openBrace)
      if (closeBrace !== -1) {
        return cleaned.slice(openBrace, closeBrace + 1)
      }
    }
  }

  // 回退：找第一个 { 和最后一个 }
  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1)
  }

  return cleaned
}

// 从 openIndex 开始找匹配的 }，跳过 JSON 字符串内的 {}
function findMatchingBrace(text: string, openIndex: number): number {
  let depth = 0
  let inString = false
  let escapeNext = false

  for (let index = openIndex; index < text.length; index++) {
    const char = text[index]

    if (escapeNext) {
      escapeNext = false
      continue
    }

    if (char === '\\') {
      escapeNext = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (char === '{') depth++
    if (char === '}') {
      depth--
      if (depth === 0) return index
    }
  }

  return -1
}

function buildRecommendationSuggestions(projects: GithubProject[]) {
  if (projects.length === 0) return ['放宽来源账号、语言、成熟度或时间范围筛选后重新推荐。']
  return projects.map((project) => `先阅读 ${project.fullName} 的 README、许可证和最近提交，再决定是否深入使用。`)
}
