// POST /api/project-profiles — 项目简介管理（status 查询 / generate 生成 / regenerate 重新生成 / vector-status 索引状态 / sync-vectors 同步索引）
import { resolveErrorMessage } from '@/lib/api-response'
import { normalizePreference } from '@/lib/default-preference'
import { generateMissingProjectProfiles, getProjectProfileStatus, getVectorIndexStatus, regenerateProjectProfiles, syncUnindexedProjectVectors } from '@/lib/project-profile-service'
import type { GithubProject, ProjectMaturity, ProjectProfileProgress, UserPreference, VectorIndexStatus } from '@/types/insight-radar'

interface ProjectProfilesRequestBody {
  action: 'status' | 'generate' | 'regenerate' | 'vector-status' | 'sync-vectors'
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
  vectorStatus?: VectorIndexStatus
  syncedCount?: number
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

    if (body.action === 'vector-status') {
      const vectorStatus = await getVectorIndexStatus(filters)
      const response: ProjectProfilesResponseBody = {
        progress: { status: 'ready', completedCount: vectorStatus.indexedCount, totalCount: vectorStatus.indexedCount + vectorStatus.unindexedCount, message: null },
        processedRepositoryIds: [],
        projects: [],
        vectorStatus,
        error: null,
      }
      return Response.json(response)
    }

    if (body.action === 'sync-vectors') {
      const result = await syncUnindexedProjectVectors(filters)
      const response: ProjectProfilesResponseBody = {
        progress: { status: 'ready', completedCount: 0, totalCount: 0, message: null },
        processedRepositoryIds: [],
        projects: [],
        vectorStatus: result,
        syncedCount: result.syncedCount,
        error: null,
      }
      return Response.json(response)
    }

    // status / generate / regenerate
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
