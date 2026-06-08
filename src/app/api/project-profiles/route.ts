import { resolveErrorMessage } from '@/lib/api-response'
import { normalizePreference } from '@/lib/default-preference'
import { generateMissingProjectProfiles, getProjectProfileStatus, regenerateProjectProfiles } from '@/lib/project-profile-service'
import type { GithubProject, ProjectMaturity, ProjectProfileProgress, UserPreference } from '@/types/insight-radar'

interface ProjectProfilesRequestBody {
  action: 'status' | 'generate' | 'regenerate'
  query?: string
  filters: {
    query?: string
    languages?: string[]
    maturity?: ProjectMaturity[]
    sourceGithubUsername?: string | null
    days?: number | null
  }
  preference?: Partial<UserPreference>
  processedRepositoryIds?: string[]
}

interface ProjectProfilesResponseBody {
  progress: ProjectProfileProgress
  processedRepositoryIds: string[]
  projects: GithubProject[]
  error: string | null
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as ProjectProfilesRequestBody
    const filters = {
      query: body.filters.query ?? '',
      languages: body.filters.languages ?? [],
      maturity: body.filters.maturity ?? [],
      sourceGithubUsername: body.filters.sourceGithubUsername ?? null,
      days: body.filters.days ?? null,
    }
    const preference = normalizePreference(body.preference)
    const processedRepositoryIds = body.processedRepositoryIds ?? []
    const profileResult = body.action === 'status'
      ? { ...(await getProjectProfileStatus(filters)), processedRepositoryIds }
      : body.action === 'regenerate'
        ? await regenerateProjectProfiles(filters, preference, processedRepositoryIds)
        : { ...(await generateMissingProjectProfiles(filters, preference)), processedRepositoryIds }
    const response: ProjectProfilesResponseBody = {
      progress: profileResult,
      processedRepositoryIds: profileResult.processedRepositoryIds,
      projects: (profileResult as { updatedProjects?: GithubProject[] }).updatedProjects ?? [],
      error: null,
    }

    return Response.json(response)
  } catch (error) {
    const response: ProjectProfilesResponseBody = {
      progress: {
        status: 'failed',
        completedCount: 0,
        totalCount: 0,
        message: resolveErrorMessage(error, '项目简介生成失败，请稍后重试。'),
      },
      processedRepositoryIds: [],
      projects: [],
      error: resolveErrorMessage(error, '项目简介生成失败，请稍后重试。'),
    }

    return Response.json(response, { status: 500 })
  }
}
