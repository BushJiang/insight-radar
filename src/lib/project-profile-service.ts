import { createHash } from 'crypto'
import { mastra } from '@/mastra'
import { countProjectsForFilters, countProjectsMissingProfiles, listProjectsForProfileRegeneration, listProjectsMissingProfiles, searchProjectsFromDatabase, updateProjectProfile } from '@/lib/projects-repository'
import type { GithubProject, ProjectProfileProgress, ProjectSearchFilters, UserPreference } from '@/types/insight-radar'

const projectProfileMaxLength = 280
const maxGeneratedProfilesPerRequest = 20
const aiGenerateTimeoutMs = 30_000
const aiGenerateConcurrency = 10

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

  await generateAndSaveProjectProfiles(projects, preference, false)

  const remainingCount = await countProjectsMissingProfiles(filters)
  const completedCount = Math.max(0, totalMissingCount - remainingCount)

  return {
    status: remainingCount === 0 ? 'ready' : 'running',
    completedCount,
    totalCount: totalMissingCount,
    message: remainingCount === 0 ? null : '正在生成项目简介',
  }
}

export async function generateMissingProjectProfiles(filters: ProjectSearchFilters, preference: UserPreference): Promise<ProjectProfileProgress> {
  return ensureProjectProfiles(filters, preference)
}

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
  const tasks = projects
    .filter((project) => force || !project.readmeSummary?.trim())
    .map((project) => async () => {
      try {
        const profile = await generateProjectProfile(project, preference.projectProfileAgentPrompt)
        await updateProjectProfile(project.repositoryId, profile)
      } catch (error) {
        console.error(`项目简介生成失败 ${project.repositoryId}:`, error instanceof Error ? error.message : String(error))
      }
    })

  const workers = Array.from({ length: aiGenerateConcurrency })
  await Promise.all(workers.map(async () => {
    while (tasks.length > 0) {
      const task = tasks.shift()
      if (task) await task()
    }
  }))
}

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

export function buildProfileHash(project: GithubProject) {
  return createHash('sha256')
    .update([
      project.repositoryId,
      project.name,
      project.fullName,
      project.description,
      project.readmeSummary ?? '',
      project.language,
      project.maturity,
      project.sourceGithubUsername,
      project.githubUpdatedAt ?? project.updatedAt,
    ].join('\n'))
    .digest('hex')
}

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

  const profile = resolveProjectProfile(result.text, project)

  return truncateProjectProfile(profile)
}

function resolveProjectProfile(text: string | undefined, project: GithubProject) {
  const profile = text?.trim()

  return profile || buildFallbackProjectProfile(project)
}

function buildFallbackProjectProfile(_project: GithubProject) {
  return '暂无项目简介。'
}

function truncateProjectProfile(profile: string) {
  return profile.slice(0, projectProfileMaxLength)
}

function buildProjectProfilePrompt(project: GithubProject, prompt: string) {
  const readme = project.readmeContent
    ? stripHtml(project.readmeContent).slice(0, 500)
    : '暂无 README。'

  return `${prompt}

变量：
- 项目名称：${project.name}
- 仓库全名：${project.fullName}
- 项目描述：${project.description}
- 主要语言：${project.language}
- README：${readme}`
}

function stripHtml(text: string) {
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
