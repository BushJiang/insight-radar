// 项目简介服务：并发生成/重新生成项目 AI 简介（Mastra Agent + deepseek-v4-flash），写入 projects.readme_summary
import { mastra } from '@/mastra'
import { getAllVectorRepositoryIds, getLastIndexedAt, upsertProjectProfileVectors } from '@/lib/project-vector-store'
import { countProjectsForFilters, countProjectsMissingProfiles, listProjectsForProfileRegeneration, listProjectsMissingProfiles, searchProjectsFromDatabase, updateProjectProfile } from '@/lib/projects-repository'
import { stripHtml } from '@/lib/utils'
import type { GithubProject, ProjectProfileProgress, ProjectSearchFilters, UserPreference, VectorIndexStatus } from '@/types/insight-radar'

// 项目简介最终截断上限（字符数），DB 字段 readme_summary 为 varchar(300)
const projectProfileMaxLength = 280
// 单次 API 请求最多处理项目数。取值 20 兼顾并行效率与单次请求耗时
const maxGeneratedProfilesPerRequest = 20
// 单个 AI 生成调用超时（毫秒），超时后 Promise.race 抛出异常，上层 per-item catch 接住跳过
const aiGenerateTimeoutMs = 30_000
// 同批内并发 AI 调用数。不超过 maxGeneratedProfilesPerRequest，避免 Node 连接池瓶颈
const aiGenerateConcurrency = 10
const vectorUpsertTimeoutMs = Number(process.env.PROJECT_PROFILE_VECTOR_UPSERT_TIMEOUT_MS || 30_000)

// 检查并生成缺失的项目简介（推荐前自动调用）。一次最多生成 20 个
export async function ensureProjectProfiles(filters: ProjectSearchFilters, preference: UserPreference): Promise<ProjectProfileProgress> {
  const totalMissingCount = await countProjectsMissingProfiles(filters)

  if (totalMissingCount === 0) {
    return {
      status: 'ready',
      completedCount: 0,
      totalCount: 0,
      message: null,
    }
  }

  const projects = await listProjectsMissingProfiles({
    ...filters,
    limit: Math.min(maxGeneratedProfilesPerRequest, totalMissingCount),
  })

  const savedProjects = await generateAndSaveProjectProfiles(projects, preference, false)
  const remainingCount = await countProjectsMissingProfiles(filters)
  const completedCount = Math.max(0, totalMissingCount - remainingCount, savedProjects.length)

  return {
    status: remainingCount === 0 ? 'ready' : 'running',
    completedCount,
    totalCount: totalMissingCount,
    message: remainingCount === 0 ? null : '正在生成项目简介',
  }
}

// 生成缺失的项目简介（ensureProjectProfiles 的别名，给 API 路由直接调用）
export async function generateMissingProjectProfiles(filters: ProjectSearchFilters, preference: UserPreference): Promise<ProjectProfileProgress> {
  return ensureProjectProfiles(filters, preference)
}

export async function generateAndSaveMissingProjectProfiles(projects: GithubProject[], preference: UserPreference): Promise<ProjectProfileProgress> {
  const projectsMissingProfiles = projects.filter((project) => !project.projectSummary?.trim())

  if (projectsMissingProfiles.length === 0) {
    return {
      status: 'ready',
      completedCount: 0,
      totalCount: 0,
      message: null,
    }
  }

  const savedProjects = await generateAndSaveProjectProfiles(projectsMissingProfiles, preference, false)
  const completedCount = savedProjects.length
  const isReady = completedCount === projectsMissingProfiles.length

  return {
    status: isReady ? 'ready' : 'failed',
    completedCount,
    totalCount: projectsMissingProfiles.length,
    message: isReady ? null : '部分项目简介生成失败',
  }
}

// 重新生成已有简介的项目（用于「重新生成项目简介」按钮），支持增量处理跳过已生成的
export async function regenerateProjectProfiles(filters: ProjectSearchFilters, preference: UserPreference, processedRepositoryIds: string[] = []): Promise<ProjectProfileProgress & { processedRepositoryIds: string[]; updatedProjects: GithubProject[] }> {
  const totalCount = await countProjectsForFilters(filters)

  if (totalCount === 0) {
    return {
      status: 'ready',
      completedCount: 0,
      totalCount: 0,
      message: null,
      processedRepositoryIds,
      updatedProjects: [],
    }
  }

  const projects = await listProjectsForProfileRegeneration({
    ...filters,
    excludeRepositoryIds: processedRepositoryIds,
    limit: Math.min(maxGeneratedProfilesPerRequest, totalCount),
  })

  if (projects.length === 0) {
    return {
      status: 'ready',
      completedCount: totalCount,
      totalCount,
      message: null,
      processedRepositoryIds,
      updatedProjects: [],
    }
  }

  await generateAndSaveProjectProfiles(projects, preference, true)

  const nextProcessedRepositoryIds = [...processedRepositoryIds, ...projects.map((project) => project.repositoryId)]
  const completedCount = Math.min(totalCount, nextProcessedRepositoryIds.length)
  const isReady = completedCount >= totalCount

  // 再生全部完成时，返回最新项目数据，前端无需额外请求
  const updatedProjects = isReady
    ? (await searchProjectsFromDatabase({ ...filters, page: 1, pageSize: 50 })).projects
    : []

  return {
    status: isReady ? 'ready' : 'running',
    completedCount,
    totalCount,
    message: isReady ? null : '正在重新生成项目简介',
    processedRepositoryIds: nextProcessedRepositoryIds,
    updatedProjects,
  }
}

async function generateAndSaveProjectProfiles(projects: GithubProject[], preference: UserPreference, force: boolean) {
  const savedProjects: GithubProject[] = []
  const pendingProjects = projects.filter((project) => force || !project.projectSummary?.trim())

  console.log(`[project-profile] 🤖 正在为 ${pendingProjects.length} 个项目生成 AI 简介...`)
  const tasks = pendingProjects.map((project) => async () => {
    try {
      const profile = await generateProjectProfile(project, preference.projectProfileAgentPrompt)
      await updateProjectProfile(project.repositoryId, profile)
      savedProjects.push({ ...project, projectSummary: profile })
    } catch (error) {
      console.error(`[project-profile] 项目简介生成失败 ${project.repositoryId}:`, error instanceof Error ? error.message : String(error))
    }
  })

  const workers = Array.from({ length: aiGenerateConcurrency })
  await Promise.all(workers.map(async () => {
    while (tasks.length > 0) {
      const task = tasks.shift()
      if (task) await task()
    }
  }))
  console.log(`[project-profile] 📝 项目简介生成完成 (成功 ${savedProjects.length}/${pendingProjects.length})`)

  return savedProjects
}

// 查询向量索引状态：有多少项目有简介但未向量化，以及最后同步时间
export async function getVectorIndexStatus(filters: ProjectSearchFilters): Promise<VectorIndexStatus> {
  const [projectsWithProfiles, vectorIds] = await Promise.all([
    listProjectsForProfileRegeneration({ ...filters, excludeRepositoryIds: [], limit: 10000 }),
    getAllVectorRepositoryIds(),
  ])

  const projects = projectsWithProfiles.filter((project) => project.projectSummary?.trim())
  const vectorIdSet = new Set(vectorIds)
  const indexedCount = projects.filter((project) => vectorIdSet.has(project.repositoryId)).length
  const unindexedCount = projects.length - indexedCount
  const lastIndexedAt = await getLastIndexedAt()

  return {
    indexedCount,
    unindexedCount,
    lastSyncAt: lastIndexedAt ? new Date(lastIndexedAt).toISOString() : null,
  }
}

// 找出所有有简介但未向量化的项目，生成向量并写入 Milvus
export async function syncUnindexedProjectVectors(filters: ProjectSearchFilters): Promise<VectorIndexStatus & { syncedCount: number }> {
  const status = await getVectorIndexStatus(filters)

  if (status.unindexedCount === 0) {
    return { ...status, syncedCount: 0 }
  }

  const allProjects = await listProjectsForProfileRegeneration({ ...filters, excludeRepositoryIds: [], limit: 10000 })
  const vectorIds = await getAllVectorRepositoryIds()
  const vectorIdSet = new Set(vectorIds)
  const unindexedProjects = allProjects.filter((project) => project.projectSummary?.trim() && !vectorIdSet.has(project.repositoryId))

  if (unindexedProjects.length === 0) {
    return { ...status, syncedCount: 0 }
  }

  console.log(`[project-profile] 🧬 同步推荐索引: ${unindexedProjects.length} 个项目待入库`)
  try {
    await withTimeout(upsertProjectProfileVectors(unindexedProjects), vectorUpsertTimeoutMs)
    console.log(`[project-profile] 🧬 同步推荐索引完成: ${unindexedProjects.length} 个项目已入库`)
  } catch (error) {
    console.error('[project-profile] 同步推荐索引失败:', error instanceof Error ? error.message : String(error))
    throw error
  }

  const newStatus = await getVectorIndexStatus(filters)

  return { ...newStatus, syncedCount: unindexedProjects.length }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`操作超时 (${timeoutMs}ms)`)), timeoutMs),
  )

  return Promise.race([promise, timeout])
}

// 查询项目简介生成进度（未开始/进行中/已完成）
export async function getProjectProfileStatus(filters: ProjectSearchFilters): Promise<ProjectProfileProgress> {
  const [totalCount, missingCount] = await Promise.all([
    countProjectsForFilters(filters),
    countProjectsMissingProfiles(filters),
  ])

  return {
    status: missingCount === 0 ? 'ready' : 'running',
    completedCount: Math.max(0, totalCount - missingCount),
    totalCount,
    message: missingCount === 0 ? null : '有项目还没有生成项目简介',
  }
}

// maxOutputTokens=1024 而非更小值的原因：
//   中文在 tokenizer 里一个汉字约消耗 1.5~2 个 token，200 字中文简介实际需要 300~400 token。
//   加上 BOS/EOS token 和子词碎片开销，设 320 时模型经常 token 不够用，finishReason=length
//   提前中止 → result.text 为空 → 触发兜底"暂无项目简介。"。
//   1024 只是"预算管够"，模型实际仍按 prompt 中的"不超过 200 字"输出，不会写满 1024。
async function generateProjectProfile(project: GithubProject, prompt: string) {
  const agent = mastra.getAgent('projectProfileAgent')
  const generatePromise = agent.generate(buildProjectProfilePrompt(project, prompt), {
    modelSettings: {
      maxOutputTokens: 1024,
      temperature: 0.2,
    },
  })
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`AI 生成超时 (${project.repositoryId})`)), aiGenerateTimeoutMs),
  )

  const result = await Promise.race([generatePromise, timeoutPromise])

  if (!result.text?.trim()) {
    console.warn(`[project-profile] AI 返回空文本: ${project.fullName}`)
    console.warn(`[project-profile] result.text 类型: ${typeof result.text}, 值: ${JSON.stringify(result.text)}`)
    console.warn(`[project-profile] result 键: ${Object.keys(result).join(', ')}`)
  }

  const profile = resolveProjectProfile(result.text)

  return truncateProjectProfile(profile)
}

function resolveProjectProfile(text: string | undefined) {
  const profile = text?.trim()

  return profile || buildFallbackProjectProfile()
}

function buildFallbackProjectProfile() {
  return '暂无项目简介。'
}

function truncateProjectProfile(profile: string) {
  return profile.slice(0, projectProfileMaxLength)
}

// README 截取 500 字符并先清洗 HTML 的原因：
//   1. deepseek-v4-flash 在总 prompt 超过 ~3400 字符时可能返回空文本。
//   2. GitHub README 可能包含大量 HTML 标签（如 zeroclaw 的 README 全是 <p/><img/>），
//      不洗的话 500 字符里可能几乎全是标签、没有正文。
//   3. 500 字符足够覆盖项目名称、简介、技术栈等关键信息。
//   清洗顺序：先 stripHtml（全量清洗），再 slice（截取前 500），避免截断在 HTML 标签中间。
function buildProjectProfilePrompt(project: GithubProject, prompt: string) {
  const readme = project.readmeContent
    ? stripHtml(project.readmeContent).slice(0, 500)
    : '暂无 README。'

  const variables: Record<string, string> = {
    projectName: project.name,
    repositoryFullName: project.fullName,
    projectDescription: project.description,
    primaryLanguage: project.language,
    readme,
  }
  let userPrompt = prompt
  for (const [key, value] of Object.entries(variables)) {
    userPrompt = userPrompt.replaceAll(`{{${key}}}`, value)
  }

  return `${userPrompt}

项目数据：
- 项目名称：${project.name}
- 仓库全名：${project.fullName}
- 项目描述：${project.description}
- 主要语言：${project.language}
- README：${readme}`
}

