import { createHash } from 'crypto'
import { mastra } from '@/mastra'
import { countProjectsForFilters, countProjectsMissingProfiles, listProjectsForProfileRegeneration, listProjectsMissingProfiles, updateProjectProfile } from '@/lib/projects-repository'
import type { GithubProject, ProjectProfileProgress, ProjectSearchFilters, UserPreference } from '@/types/insight-radar'

const projectProfileMaxLength = 280
const maxGeneratedProfilesPerRequest = 10

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

export async function regenerateProjectProfiles(filters: ProjectSearchFilters, preference: UserPreference, processedRepositoryIds: string[] = []): Promise<ProjectProfileProgress & { processedRepositoryIds: string[] }> {
  const totalCount = await countProjectsForFilters(filters)

  if (totalCount === 0) {
    return {
      status: 'ready',
      completedCount: 0,
      totalCount: 0,
      message: null,
      processedRepositoryIds,
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
    }
  }

  await generateAndSaveProjectProfiles(projects, preference, true)

  const nextProcessedRepositoryIds = [...processedRepositoryIds, ...projects.map((project) => project.repositoryId)]
  const completedCount = Math.min(totalCount, nextProcessedRepositoryIds.length)

  return {
    status: completedCount >= totalCount ? 'ready' : 'running',
    completedCount,
    totalCount,
    message: completedCount >= totalCount ? null : '正在重新生成项目简介',
    processedRepositoryIds: nextProcessedRepositoryIds,
  }
}

async function generateAndSaveProjectProfiles(projects: GithubProject[], preference: UserPreference, force: boolean) {
  await Promise.all(projects.map(async (project) => {
    if (!force && project.readmeSummary?.trim()) {
      return
    }

    const profile = await generateProjectProfile(project, preference.projectProfileAgentPrompt)
    await updateProjectProfile(project.repositoryId, profile)
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
  const result = await agent.generate(buildProjectProfilePrompt(project, prompt), {
    modelSettings: {
      maxOutputTokens: 320,
      temperature: 0.2,
    },
  })
  const profile = resolveProjectProfile(result.text, project)

  return truncateProjectProfile(profile)
}

function resolveProjectProfile(text: string | undefined, project: GithubProject) {
  const profile = text?.trim()

  return profile || buildFallbackProjectProfile(project)
}

function buildFallbackProjectProfile(project: GithubProject) {
  const description = project.description.trim() || `${project.fullName} 是一个以 ${project.language} 为主要语言的开源项目。`

  return `${project.name}：${description}`
}

function truncateProjectProfile(profile: string) {
  return profile.slice(0, projectProfileMaxLength)
}

function buildProjectProfilePrompt(project: GithubProject, prompt: string) {
  const readme = project.readmeContent ? project.readmeContent.slice(0, 8000) : '暂无 README。'

  return `${prompt}

变量：
- 项目名称：${project.name}
- 仓库全名：${project.fullName}
- 项目描述：${project.description}
- 主要语言：${project.language}
- README：${readme}

请只输出项目简介正文，不要返回 JSON，不要添加标题或解释。项目简介必须是不超过 200 个中文字符的完整字符串。`
}
