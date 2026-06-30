// 智能推荐服务：提供推荐工作流需要的纯业务能力，具体编排由 Mastra workflow 负责
import { z } from 'zod'
import { projectAnalysisAgent } from '@/mastra/agents/project-analysis-agent'
import { projectRecommendationAgent } from '@/mastra/agents/project-recommendation-agent'
import { getProjectMapByRepositoryIds } from '@/lib/projects-repository'
import { buildProfileHash } from '@/lib/project-profile-hash'
import { ensureProjectProfileReadinessForRecommendation, type ProjectProfileReadinessResult } from '@/lib/project-profile-service'
import { searchProjectProfileVectors } from '@/lib/project-vector-store'
import { resolveDeepSeekModel } from '@/lib/server-api-keys'
import { truncateText } from '@/lib/utils'
import type { GithubProject, ProjectRecommendationReason, ProjectSearchFilters, RecommendationExplanation, UserPreference } from '@/types/insight-radar'

const logPrefix = '[recommendation-service] '

const recommendationReasonSchema = z.object({
  repositoryId: z.union([z.string(), z.number()]).transform(String),
  fitReasons: z.array(z.string().trim().min(1)).length(3),
  riskReminder: z.string().trim().min(1),
})
const recommendationReasonsResponseSchema = z.object({
  recommendations: z.array(recommendationReasonSchema),
})
// 每批最多 10 个项目，一次 API 调用中横向对比评分，并发数由用户在设置页控制
const maxProjectsPerAnalysisBatch = 10
// 每批最多 5 个项目，一次 API 调用中批量生成推荐理由，并发数由用户在设置页控制
const maxProjectsPerReasonBatch = 5

export interface RecommendationWorkflowInput {
  query: string
  filters: ProjectSearchFilters
  recommendationLimit: number
  preference: UserPreference
}

export interface RecommendationWorkflowOutput {
  progress: { status: 'ready' | 'running' | 'failed'; completedCount: number; totalCount: number; message: string | null }
  recommendation: RecommendationExplanation | null
  projects: GithubProject[]
}

export type RecommendationReadinessResult = ProjectProfileReadinessResult

interface AnalysisResult {
  repositoryId: string
  fullName: string
  totalScore: number
  scores: Record<string, number>
  analysisReason: string
}

export interface RecommendationCandidateSearchResult extends RecommendationWorkflowInput {
  progress: RecommendationWorkflowOutput['progress']
  candidateProjects: GithubProject[]
}

export interface RecommendationAnalysisResult extends RecommendationCandidateSearchResult {
  analysisResults: AnalysisResult[]
  selectedProjects: GithubProject[]
}

export interface RecommendationReasonResult extends RecommendationAnalysisResult {
  reasons: Record<string, ProjectRecommendationReason>
}

// 生成推荐前先确保项目简介和向量状态可用；这是 workflow 的准备阶段
export async function ensureRecommendationReadiness(filters: ProjectSearchFilters, preference: UserPreference): Promise<RecommendationReadinessResult> {
  return ensureProjectProfileReadinessForRecommendation(filters, preference)
}

// 生成推荐的主入口：简介检查 → 向量搜索 → AI 分析评分筛选 → AI 生成推荐理由
export async function generateProjectRecommendations({ query, filters, recommendationLimit, preference }: RecommendationWorkflowInput) {
  console.log(`${logPrefix}🔍 收到推荐请求: "${query}"`)
  const readiness = await ensureRecommendationReadiness(filters, preference)

  if (readiness.syncedCount > 0 || readiness.profiledCount > 0) {
    console.log(`${logPrefix}🧬 推荐索引已同步: 生成简介 ${readiness.profiledCount} 个, 向量更新 ${readiness.syncedCount} 个`)
  }

  if (readiness.progress.status !== 'ready') {
    console.log(`${logPrefix}⚠️ 项目简介未就绪 (${readiness.progress.completedCount}/${readiness.progress.totalCount})，中止推荐`)
    return { progress: readiness.progress, recommendation: null, projects: [] }
  }

  return runRecommendationSearch({ query, filters, recommendationLimit, preference, progress: readiness.progress })
}

export async function searchRecommendationCandidates(input: RecommendationWorkflowInput & { progress: RecommendationWorkflowOutput['progress'] }): Promise<RecommendationCandidateSearchResult> {
  const { query, filters, recommendationLimit, preference, progress } = input
  console.log(`${logPrefix}📊 项目简介就绪 (${progress.completedCount}/${progress.totalCount})`)
  const candidateProjectCount = Math.max(1, Math.min(recommendationLimit * preference.candidateMultiplier, 50))
  console.log(`${logPrefix}🔎 开始向量搜索，候选数: ${candidateProjectCount} (推荐 ${recommendationLimit} × ${preference.candidateMultiplier} 倍)`)
  const candidateProjects = await getCandidateProjects(query, filters, candidateProjectCount)
  console.log(`${logPrefix}🎯 向量搜索返回 ${candidateProjects.length} 个候选项目`)

  return { query, filters, recommendationLimit, preference, progress, candidateProjects }
}

export async function analyzeRecommendationCandidates(input: RecommendationCandidateSearchResult): Promise<RecommendationAnalysisResult> {
  const { candidateProjects, query, preference, recommendationLimit } = input

  if (candidateProjects.length === 0) return { ...input, analysisResults: [], selectedProjects: [] }

  console.log(`${logPrefix}📊 正在分析 ${candidateProjects.length} 个候选项目...`)
  let analysisResults: AnalysisResult[]

  try {
    analysisResults = await analyzeCandidateProjects(candidateProjects, query, preference, recommendationLimit)
    console.log(`${logPrefix}📊 分析完成: ${analysisResults.length} 个项目入选`)
  } catch (error) {
    console.error(`${logPrefix}项目分析失败，回退到向量相似度排序:`, error instanceof Error ? error.message : String(error))
    analysisResults = candidateProjects.slice(0, recommendationLimit).map((project) => ({
      repositoryId: project.repositoryId,
      fullName: project.fullName,
      totalScore: 0,
      scores: {},
      analysisReason: '分析失败，使用默认排序。'
    }))
  }

  const selectedProjects = analysisResults
    .map((result) => candidateProjects.find((project) => String(project.repositoryId) === String(result.repositoryId)))
    .filter((project): project is GithubProject => Boolean(project))

  return { ...input, analysisResults, selectedProjects }
}

export async function generateRecommendationReasonMap(input: RecommendationAnalysisResult): Promise<RecommendationReasonResult> {
  const { selectedProjects, query, preference, recommendationLimit } = input

  console.log(`${logPrefix}🤖 正在为 ${selectedProjects.length} 个项目生成推荐理由...`)
  const reasons = await generateRecommendationReasons({ query, preference, recommendationLimit, candidateProjects: selectedProjects })
  console.log(`${logPrefix}📝 推荐理由生成完成 (${Object.keys(reasons).length} 条)`)

  return { ...input, reasons }
}

export function buildRecommendationResult({ query, recommendationLimit, progress, candidateProjects, analysisResults, selectedProjects, reasons }: RecommendationReasonResult): RecommendationWorkflowOutput {
  if (progress.status !== 'ready') return { progress, recommendation: null, projects: [] }

  if (candidateProjects.length === 0) {
    console.log(`${logPrefix}⚠️ 无候选项目，结束推荐`)
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

  const projectIds = selectedProjects.map((project) => project.repositoryId)
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

  console.log(`${logPrefix}✅ 推荐完成 (${projectIds.length} 个入选项目, 置信度: ${recommendation.confidence})`)
  return { progress, recommendation, projects: candidateProjects }
}

// 将“搜索 + 分析 + 生成理由”收束为一个推荐阶段，保留给非 workflow 调用复用
export async function runRecommendationSearch(input: RecommendationWorkflowInput & { progress: RecommendationWorkflowOutput['progress'] }) {
  const candidates = await searchRecommendationCandidates(input)
  const analysis = await analyzeRecommendationCandidates(candidates)
  const reasons = await generateRecommendationReasonMap(analysis)

  return buildRecommendationResult(reasons)
}

// analyzeCandidateProjects 对候选项目进行 AI 分析评分，每批最多 10 个，按用户设置的并发数同时执行若干批
async function analyzeCandidateProjects(candidates: GithubProject[], query: string, preference: UserPreference, limit: number): Promise<AnalysisResult[]> {
  const batches: GithubProject[][] = []
  for (let index = 0; index < candidates.length; index += maxProjectsPerAnalysisBatch) {
    batches.push(candidates.slice(index, index + maxProjectsPerAnalysisBatch))
  }

  console.log(`${logPrefix}📊 分析评分: ${candidates.length} 个项目分 ${batches.length} 批, 并发 ${preference.analysisConcurrency}`)
  const batchResults = await runBatchWithConcurrency(batches, preference.analysisConcurrency, (batch) =>
    analyzeCandidateBatch(batch, query, preference, Math.min(limit, batch.length)),
  )

  const allResults = batchResults.flat()
  allResults.sort((left, right) => right.totalScore - left.totalScore)

  return allResults.slice(0, limit)
}

// analyzeCandidateBatch 对一批候选项目调用分析智能体进行评分
async function analyzeCandidateBatch(candidates: GithubProject[], query: string, preference: UserPreference, selectCount: number): Promise<AnalysisResult[]> {
  const userPrompt = buildAnalysisPrompt(candidates, query, preference, selectCount)

  const result = await projectAnalysisAgent.generate(userPrompt, {
    modelSettings: {
      maxOutputTokens: 8192,
    },
    model: await resolveDeepSeekModel('deepseek-v4-pro'),
  })

  const rawText = result.text ?? ''
  console.log(`${logPrefix}📊 智能体分析原始输出:\n${rawText}`)
  const jsonText = extractJson(rawText)

  try {
    const parsed = JSON.parse(jsonText) as { selectedProjects?: AnalysisResult[] }

    if (!Array.isArray(parsed.selectedProjects) || parsed.selectedProjects.length === 0) {
      throw new Error('分析结果为空')
    }

    return parsed.selectedProjects
  } catch (error) {
    console.error(`${logPrefix}分析结果解析失败:`, error instanceof Error ? error.message : String(error))
    console.error(`${logPrefix}JSON 提取结果:`, jsonText.slice(0, 300))
    console.error(`${logPrefix}完整原始输出:`, rawText)

    // 解析失败时回退到原始顺序
    return candidates.slice(0, selectCount).map((project) => ({
      repositoryId: project.repositoryId,
      fullName: project.fullName,
      totalScore: 0,
      scores: {},
      analysisReason: '评分解析失败。'
    }))
  }
}

// buildAnalysisPrompt 构造项目分析智能体的用户提示词（评分框架在 instructions 中，此处只传项目数据）
function buildAnalysisPrompt(candidates: GithubProject[], query: string, preference: UserPreference, selectCount: number): string {
  const domainsText = preference.domains.length > 0 ? preference.domains.join('、') : '无固定领域偏好'
  const candidateTexts = candidates.map((project, index) => buildProjectCard(project, index + 1))

  return `用户需求：${query || '未填写'}
领域偏好：${domainsText}
选出 ${selectCount} 个最值得推荐的项目

候选项目列表：
${candidateTexts.join('\n\n')}`
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
  console.log(`${logPrefix}🔎 Milvus 向量搜索完成: ${vectorResults.length} 条命中`)

  if (vectorResults.length === 0) {
    console.log(`${logPrefix}⚠️ Milvus 无命中，可能原因: 向量库无数据 / 搜索返回空 / 调用异常`)
    return []
  }

  const freshResults = await resolveFreshVectorProjects(vectorResults)
  const staleCount = vectorResults.length - freshResults.length

  if (staleCount > 0) {
    console.log(`${logPrefix}🧹 过滤掉 ${staleCount} 条过期向量 (profileHash 不匹配)`)
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
        console.log(`${logPrefix}🗑️  ${result.repositoryId}: PostgreSQL 中不存在或已删除`)
        return null
      }
      const currentHash = buildProfileHash(project)
      if (currentHash !== result.profileHash) {
        console.log(`${logPrefix}🗑️  ${result.repositoryId} (${project.fullName}): profileHash 不匹配, 向量已过期`)
        return null
      }
      return project
    })
    .filter((project): project is GithubProject => Boolean(project))
}

async function generateRecommendationReasons({ query, preference, recommendationLimit, candidateProjects }: { query: string; preference: UserPreference; recommendationLimit: number; candidateProjects: GithubProject[] }) {
  if (candidateProjects.length === 0) return {}

  // 分批，每批最多 5 个项目
  const batches: GithubProject[][] = []
  for (let index = 0; index < candidateProjects.length; index += maxProjectsPerReasonBatch) {
    batches.push(candidateProjects.slice(index, index + maxProjectsPerReasonBatch))
  }

  console.log(`${logPrefix}🤖 推荐理由: ${candidateProjects.length} 个项目分 ${batches.length} 批, 并发 ${preference.reasonConcurrency}`)

  try {
    const batchResults = await runBatchWithConcurrency(batches, preference.reasonConcurrency, (batch) =>
      generateReasonsBatch(batch, query, preference, recommendationLimit),
    )

    return Object.fromEntries(batchResults.flat())
  } catch (error) {
    console.error(`${logPrefix}推荐理由并发批处理失败:`, error instanceof Error ? error.message : String(error))
    return Object.fromEntries(candidateProjects.map((project) => [project.repositoryId, buildFallbackRecommendationReason(project, query)]))
  }
}

// generateReasonsBatch 一次调用为一个批次的所有项目生成推荐理由
async function generateReasonsBatch(projects: GithubProject[], query: string, preference: UserPreference, recommendationLimit: number): Promise<Array<[string, ProjectRecommendationReason]>> {
  const userPrompt = buildBatchReasonPrompt(projects, query, preference, recommendationLimit)

  const result = await projectRecommendationAgent.generate(userPrompt, {
    modelSettings: { maxOutputTokens: 2048 },
    model: await resolveDeepSeekModel('deepseek-v4-pro'),
  })

  const rawText = result.text ?? ''
  console.log(`${logPrefix}📝 推荐理由智能体原始输出:\n${rawText}`)
  const jsonText = extractJson(rawText)
  console.log(`${logPrefix}📝 推荐理由 JSON 提取结果:\n${jsonText}`)

  try {
    const parsed = recommendationReasonsResponseSchema.parse(JSON.parse(jsonText))
    console.log(`${logPrefix}📝 推荐理由 JSON 解析结果:\n${JSON.stringify(parsed, null, 2)}`)
    const projectIds = new Set(projects.map((project) => String(project.repositoryId)))
    const reasons = parsed.recommendations.filter((item) => projectIds.has(item.repositoryId))

    if (reasons.length !== projects.length) {
      throw new Error('推荐理由数量与项目数量不一致')
    }

    return reasons.map((item) => [item.repositoryId, item] as [string, ProjectRecommendationReason])
  } catch (error) {
    console.error(`${logPrefix}推荐理由批处理解析失败:`, error instanceof Error ? error.message : String(error))
    // 解析失败时回退到逐个项目的兜底理由
    return projects.map((project) => [project.repositoryId, buildFallbackRecommendationReason(project, query)] as [string, ProjectRecommendationReason])
  }
}

// buildBatchReasonPrompt 构造批处理推荐理由提示词
function buildBatchReasonPrompt(projects: GithubProject[], query: string, preference: UserPreference, recommendationLimit: number): string {
  const domainsText = preference.domains.length > 0 ? preference.domains.join('、') : '无固定领域偏好'
  const projectList = projects.map((project, index) => [
    `项目 ${index + 1}：${project.fullName}`,
    `   ID: ${project.repositoryId}`,
    `   描述：${project.description}`,
    `   项目简介：${project.projectSummary ?? '暂无项目简介'}`,
    `   语言：${project.language}  Stars：${project.stars}  成熟度：${project.maturity}`,
    `   来源：${project.sourceGithubUsername}  链接：${project.sourceUrl}`,
  ].join('\n')).join('\n\n')

  return `请为以下每个项目生成推荐卡片文案。

用户需求：${query || '用户未填写具体需求'}
领域偏好：${domainsText}
总共推荐 ${recommendationLimit} 个项目中的 ${projects.length} 个

${projectList}

请只输出合法 JSON，不要使用 Markdown，不要输出解释文字。
每个项目只输出 repositoryId、fitReasons、riskReminder。
fitReasons 必须正好 3 条，每条尽量保持一行展示，不能带编号或项目符号。
riskReminder 必须 1 条，尽量保持一行展示。
不要输出项目名、简介、评分、GitHub 链接、上手路径或上手建议。

JSON 格式：
{
  "recommendations": [
    {
      "repositoryId": "项目ID",
      "fitReasons": ["能力匹配需求", "文档较完整", "方向符合偏好"],
      "riskReminder": "维护活跃度待确认"
    }
  ]
}`
}

function buildFallbackRecommendationReason(project: GithubProject, query: string): ProjectRecommendationReason {
  return {
    repositoryId: project.repositoryId,
    fitReasons: [
      '需求相关度高',
      '项目信息完整',
      query ? '匹配当前需求' : '适合继续评估',
    ],
    riskReminder: '维护状态需确认'
  }
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

// runBatchWithConcurrency 并发执行批处理任务，最多 concurrency 个批次同时执行
async function runBatchWithConcurrency<T, R>(batches: T[][], concurrency: number, processor: (batch: T[]) => Promise<R[]>): Promise<R[][]> {
  const queue = batches.map((batch, index) => ({ batch, index }))
  const results: R[][] = new Array(batches.length)
  const workers = Array.from({ length: Math.min(concurrency, batches.length) })

  await Promise.all(workers.map(async () => {
    while (queue.length > 0) {
      const item = queue.shift()!
      results[item.index] = await processor(item.batch)
    }
  }))

  return results
}

function buildRecommendationSuggestions(projects: GithubProject[]) {
  if (projects.length === 0) return ['放宽来源账号、语言、成熟度或时间范围筛选后重新推荐。']
  return projects.map((project) => `先阅读 ${project.fullName} 的 README、许可证和最近提交，再决定是否深入使用。`)
}
