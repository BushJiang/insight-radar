// POST /api/project-profiles — 项目简介管理（status 查询 / generate 生成 / regenerate 重新生成 / vector-status 索引状态 / sync-vectors 同步索引）
import { resolveErrorMessage } from '@/lib/api-response'
import { normalizePreference } from '@/lib/default-preference'
import { generateMissingProjectProfiles, getProjectProfileStatus, getVectorIndexStatus, regenerateProjectProfiles, syncUnindexedProjectVectors } from '@/lib/project-profile-service'
import type { GithubProject, ProjectMaturity, ProjectProfileProgress, ProjectSearchFilters, UserPreference, VectorIndexStatus } from '@/types/insight-radar'

type ProjectProfileAction = 'status' | 'generate' | 'regenerate' | 'vector-status' | 'sync-vectors'

interface ProjectProfilesRequestBody {
  action: ProjectProfileAction
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

interface ProjectProfileActionContext {
  body: ProjectProfilesRequestBody
  filters: ProjectSearchFilters
  preference: UserPreference
}

const actionHandlers: Record<ProjectProfileAction, (context: ProjectProfileActionContext) => Promise<ProjectProfilesResponseBody>> = {
  status: handleStatus,
  generate: handleGenerate,
  regenerate: handleRegenerate,
  'vector-status': handleVectorStatus,
  'sync-vectors': handleSyncVectors,
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as ProjectProfilesRequestBody
    const filters = resolveProjectProfileFilters(body)
    const preference = normalizePreference(body.preference)
    const handler = actionHandlers[body.action] ?? handleGenerate
    const response = await handler({ body, filters, preference })

    return Response.json(response)
  } catch (error) {
    return Response.json(buildErrorResponse(error), { status: 500 })
  }
}

function resolveProjectProfileFilters(body: ProjectProfilesRequestBody): ProjectSearchFilters {
  return {
    query: body.filters.query ?? '',
    languages: body.filters.languages ?? [],
    maturity: body.filters.maturity ?? [],
    sourceGithubUsername: body.filters.sourceGithubUsername ?? null,
    days: body.filters.days ?? null,
  }
}

async function handleVectorStatus({ filters }: ProjectProfileActionContext): Promise<ProjectProfilesResponseBody> {
  const vectorStatus = await getVectorIndexStatus(filters)

  return buildProfileResponse({
    progress: { status: 'ready', completedCount: vectorStatus.indexedCount, totalCount: vectorStatus.indexedCount + vectorStatus.unindexedCount, message: null },
    vectorStatus,
  })
}

async function handleSyncVectors({ filters, preference }: ProjectProfileActionContext): Promise<ProjectProfilesResponseBody> {
  const result = await syncUnindexedProjectVectors(filters, preference)

  return buildProfileResponse({
    progress: { status: 'ready', completedCount: 0, totalCount: 0, message: null },
    vectorStatus: result,
    syncedCount: result.syncedCount,
  })
}

async function handleStatus({ body, filters }: ProjectProfileActionContext): Promise<ProjectProfilesResponseBody> {
  const progress = await getProjectProfileStatus(filters)

  return buildProfileResponse({
    progress,
    processedRepositoryIds: body.processedRepositoryIds ?? [],
  })
}

async function handleGenerate({ body, filters, preference }: ProjectProfileActionContext): Promise<ProjectProfilesResponseBody> {
  const progress = await generateMissingProjectProfiles(filters, preference)

  return buildProfileResponse({
    progress,
    processedRepositoryIds: body.processedRepositoryIds ?? [],
  })
}

async function handleRegenerate({ body, filters, preference }: ProjectProfileActionContext): Promise<ProjectProfilesResponseBody> {
  const result = await regenerateProjectProfiles(filters, preference, body.processedRepositoryIds ?? [])

  return buildProfileResponse({
    progress: result,
    processedRepositoryIds: result.processedRepositoryIds,
    projects: result.updatedProjects,
  })
}

function buildProfileResponse(overrides: Partial<ProjectProfilesResponseBody>): ProjectProfilesResponseBody {
  return {
    progress: { status: 'ready', completedCount: 0, totalCount: 0, message: null },
    processedRepositoryIds: [],
    projects: [],
    error: null,
    ...overrides,
  }
}

function buildErrorResponse(error: unknown): ProjectProfilesResponseBody {
  const message = resolveErrorMessage(error, '项目简介生成失败，请稍后重试。')

  return buildProfileResponse({
    progress: {
      status: 'failed',
      completedCount: 0,
      totalCount: 0,
      message,
    },
    error: message,
  })
}
