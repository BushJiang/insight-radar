// GitHub Star 采集：GraphQL API 分页拉取 Star 仓库 + REST API 取 README + 推断成熟度 + 去重写入 DB
import { createHash } from 'crypto'
import { normalizePreference } from '@/lib/default-preference'
import { generateAndSaveMissingProjectProfiles } from '@/lib/project-profile-service'
import { persistCollectedProjects, searchProjectsFromDatabase, type PersistProjectsResult } from '@/lib/projects-repository'
import { stripHtml } from '@/lib/utils'
import type { GithubProject, GithubStarredSearchResponse, ProjectMaturity, ProjectSearchFilters, UserPreference } from '@/types/insight-radar'

const githubStarredPageSize = 100
const defaultMaxFetchedRepositories = 500
const githubGraphqlEndpoint = 'https://api.github.com/graphql'

const starredReposQuery = `
query($username: String!, $first: Int!, $after: String) {
  user(login: $username) {
    starredRepositories(
      first: $first
      after: $after
      orderBy: {field: STARRED_AT, direction: DESC}
    ) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        starredAt
        node {
          databaseId
          name
          nameWithOwner
          description
          url
          stargazerCount
          forkCount
          primaryLanguage { name }
          licenseInfo { spdxId name }
          repositoryTopics(first: 20) { nodes { topic { name } } }
          isFork
          parent { nameWithOwner url }
          defaultBranchRef { name }
          updatedAt
          pushedAt
          issues(states: OPEN) { totalCount }
        }
      }
    }
  }
}`

// GraphQL 响应类型
interface GraphqlStarredEdge {
  starredAt: string
  node: {
    databaseId: number
    name: string
    nameWithOwner: string
    description: string | null
    url: string
    stargazerCount: number
    forkCount: number
    primaryLanguage: { name: string } | null
    licenseInfo: { spdxId: string | null; name: string | null } | null
    repositoryTopics: { nodes: Array<{ topic: { name: string } }> }
    isFork: boolean
    parent: { nameWithOwner: string; url: string } | null
    defaultBranchRef: { name: string } | null
    updatedAt: string
    pushedAt: string | null
    issues: { totalCount: number }
  }
}

interface GraphqlStarredResponse {
  data?: {
    user?: {
      starredRepositories: {
        totalCount: number
        pageInfo: { hasNextPage: boolean; endCursor: string | null }
        edges: GraphqlStarredEdge[]
      }
    }
  }
  errors?: Array<{ message: string }>
}

export interface GithubStarCollectionInput {
  filters: ProjectSearchFilters
  githubToken?: string
  maxProjects?: number
  preference?: Partial<UserPreference>
}

export interface GithubStarCollectionPreparedInput extends GithubStarCollectionInput {
  username: string
  normalizedPreference: UserPreference
}

export interface GithubStarRepositoryData extends GithubStarCollectionPreparedInput {
  edges: GraphqlStarredEdge[]
  totalCount: number | null
}

export interface GithubStarPersistedData extends GithubStarRepositoryData {
  collectedProjects: GithubProject[]
  persistedResult: PersistProjectsResult
}

export type GithubStarProfileData = GithubStarPersistedData

type GithubStarCollectionProgressStep = 'fetch_stars' | 'fetch_details' | 'persist' | 'generate_profiles'

type GithubStarCollectionProgressReporter = (step: GithubStarCollectionProgressStep) => void | Promise<void>

interface SearchGithubStarredProjectsOptions extends GithubStarCollectionInput {
  onProgress?: GithubStarCollectionProgressReporter
}

// 准备采集请求：后续步骤只关心已清洗过的用户名和完整偏好配置
export function prepareGithubStarCollectionInput(input: GithubStarCollectionInput): GithubStarCollectionPreparedInput {
  const username = input.filters.sourceGithubUsername?.trim()

  if (!username) {
    throw new GithubApiError('请输入来源账号后再搜索。', 400)
  }

  return {
    ...input,
    username,
    normalizedPreference: normalizePreference(input.preference),
  }
}

// 通过 GitHub GraphQL API 获取指定账号 Star 的项目列表，提取 README 并推断成熟度
export async function searchGithubStarredProjects({ filters, githubToken, maxProjects, preference, onProgress }: SearchGithubStarredProjectsOptions): Promise<GithubStarredSearchResponse> {
  const preparedInput = prepareGithubStarCollectionInput({ filters, githubToken, maxProjects, preference })

  await onProgress?.('fetch_stars')
  const repositoryData = await collectGithubStarRepositoryData(preparedInput)
  const persistedData = await persistGithubStarCollection(repositoryData, onProgress)
  const profileData = await prepareGithubStarProjectProfiles(persistedData, onProgress)

  return buildGithubStarCollectionResult(profileData)
}

// 采集阶段：统一封装 Star 列表和 README 获取，对下游只输出仓库数据
export async function collectGithubStarRepositoryData(input: GithubStarCollectionPreparedInput): Promise<GithubStarRepositoryData> {
  const { edges, totalCount } = await fetchStarredReposViaGraphql(input.username, input.filters.days, input.maxProjects ?? defaultMaxFetchedRepositories, input.githubToken?.trim())
  console.log(`[github-starred] ✅ 采集到 ${edges.length} 个项目信息`)

  return { ...input, edges, totalCount }
}

// 持久化阶段：统一封装字段映射、成熟度推断、去重写库和结果统计
export async function persistGithubStarCollection(input: GithubStarRepositoryData, onProgress?: GithubStarCollectionProgressReporter): Promise<GithubStarPersistedData> {
  await onProgress?.('fetch_details')
  const collectedProjects = await Promise.all(input.edges.map((edge) => mapRepoEdgeToProject(edge, input.username, input.githubToken?.trim())))
  await onProgress?.('persist')
  console.log(`[github-starred] 📄 正在将 ${collectedProjects.length} 个项目写入数据库...`)
  const persistedResult = await persistCollectedProjects(collectedProjects)
  console.log(`[github-starred] 💾 数据库写入完成 (新增 ${persistedResult.createdProjects.length}, 更新 ${persistedResult.updatedDuplicateCount}, 未变 ${persistedResult.unchangedDuplicateCount})`)

  return { ...input, collectedProjects, persistedResult }
}

// 画像准备阶段：生成缺失项目简介，失败不阻断采集结果返回
export async function prepareGithubStarProjectProfiles(input: GithubStarPersistedData, onProgress?: GithubStarCollectionProgressReporter): Promise<GithubStarProfileData> {
  await onProgress?.('generate_profiles')
  console.log(`[github-starred] 🤖 正在生成项目简介...`)
  await generateProfilesAfterCollection(input.collectedProjects, input.normalizedPreference)

  return input
}

// 结果阶段：把内部采集数据整理成前端已有响应结构
export async function buildGithubStarCollectionResult(input: GithubStarProfileData): Promise<GithubStarredSearchResponse> {
  const projects = input.filters.query.trim()
    ? (await searchProjectsFromDatabase({
      query: input.filters.query,
      languages: input.filters.languages,
      maturity: input.filters.maturity,
      sourceGithubUsername: input.filters.sourceGithubUsername,
      days: input.filters.days,
      page: 1,
      pageSize: input.edges.length || 1,
    })).projects
    : input.collectedProjects

  return {
    projects,
    totalCount: projects.length,
    fetchedCount: input.edges.length,
    duplicateCount: input.persistedResult.duplicateCount,
    updatedDuplicateCount: input.persistedResult.updatedDuplicateCount,
    unchangedDuplicateCount: input.persistedResult.unchangedDuplicateCount,
    estimatedTotalCount: input.totalCount,
    rateLimitRemaining: null,
    rateLimitResetAt: null,
    error: null,
  }
}

async function generateProfilesAfterCollection(projects: GithubProject[], preference: UserPreference) {
  if (projects.length === 0) {
    return
  }

  try {
    await generateAndSaveMissingProjectProfiles(projects, preference)
  } catch (error) {
    console.error('[github-starred] 采集后项目简介生成失败:', error instanceof Error ? error.message : String(error))
  }
}

async function fetchStarredReposViaGraphql(username: string, days: number | null, maxProjects: number, githubToken?: string) {
  const edges: GraphqlStarredEdge[] = []
  const cutoff = days ? Date.now() - days * 24 * 60 * 60 * 1000 : null
  const fetchLimit = maxProjects === 0 ? Number.POSITIVE_INFINITY : Math.max(1, maxProjects)
  let totalCount: number | null = null
  let cursor: string | null = null
  let hasNextPage = true

  while (hasNextPage && edges.length < fetchLimit) {
    const remaining = Math.min(githubStarredPageSize, fetchLimit - edges.length)
    const response = await fetch(githubGraphqlEndpoint, {
      method: 'POST',
      headers: buildGraphqlHeaders(githubToken),
      body: JSON.stringify({
        query: starredReposQuery,
        variables: { username, first: remaining, after: cursor },
      }),
    })

    if (!response.ok) {
      throw await buildGithubError(response)
    }

    const body = await response.json() as GraphqlStarredResponse

    if (body.errors?.length) {
      throw new GithubApiError(body.errors.map((e) => e.message).join('; '), 400)
    }

    const starred = body.data?.user?.starredRepositories

    if (!starred) {
      throw new GithubApiError('GitHub 账号不存在，或该账号的 Star 列表不可访问。', 404)
    }

    totalCount = starred.totalCount
    hasNextPage = starred.pageInfo.hasNextPage
    cursor = starred.pageInfo.endCursor

    for (const edge of starred.edges) {
      if (cutoff && new Date(edge.starredAt).getTime() < cutoff) {
        return { edges, totalCount }
      }

      edges.push(edge)

      if (edges.length >= fetchLimit) {
        break
      }
    }
  }

  return { edges, totalCount: totalCount ?? edges.length }
}

async function mapRepoEdgeToProject(edge: GraphqlStarredEdge, username: string, githubToken?: string): Promise<GithubProject> {
  const node = edge.node
  const language = node.primaryLanguage?.name || '其他'
  const sourceRepository = node.parent ?? null
  const readmeContent = await fetchReadmeViaApi(node.nameWithOwner, githubToken)

  return {
    repositoryId: String(node.databaseId),
    fullName: node.nameWithOwner,
    name: node.name,
    description: node.description || '暂无描述',
    language,
    stars: node.stargazerCount,
    forks: node.forkCount,
    issues: node.issues.totalCount,
    updatedAt: node.updatedAt,
    githubUpdatedAt: node.updatedAt,
    pushedAt: node.pushedAt,
    projectSummary: null,
    readmeContent,
    readmeHash: readmeContent ? createHash('sha256').update(readmeContent).digest('hex') : null,
    license: node.licenseInfo?.spdxId || node.licenseInfo?.name || null,
    topics: node.repositoryTopics.nodes.map((n) => n.topic.name),
    isFork: node.isFork,
    sourceRepositoryFullName: sourceRepository?.nameWithOwner ?? null,
    sourceRepositoryUrl: sourceRepository?.url ?? null,
    sourceGithubUsername: username,
    starAt: edge.starredAt,
    sourceUrl: node.url,
    matchReason: `${username} 在 ${formatDate(edge.starredAt)} Star 了该项目。`,
    maturity: inferMaturity(node.stargazerCount, node.pushedAt ?? node.updatedAt),
    collectionJobId: `github-starred-${username}`,
  }
}

// GraphQL 无法直接拿到 README，所以通过 REST API 获取
async function fetchReadmeViaApi(fullName: string, githubToken?: string) {
  const url = `https://api.github.com/repos/${fullName}/readme`
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github.raw+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
    },
    next: { revalidate: 3600 },
  })

  if (!response.ok) {
    return null
  }

  const rawReadme = await response.text()

  return stripHtml(rawReadme)
}

function buildGraphqlHeaders(githubToken?: string) {
  return {
    'Content-Type': 'application/json',
    ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
  }
}

async function buildGithubError(response: Response) {
  if (response.status === 401) {
    return new GithubApiError('GitHub Token 无效，请在用户设置中更新后重试。', 401)
  }

  if (response.status === 403 || response.status === 429) {
    return new GithubApiError('GitHub API 访问受限，请稍后重试，或在用户设置中配置 GitHub Token。', response.status)
  }

  if (response.status === 404) {
    return new GithubApiError('GitHub 账号不存在，或该账号的 Star 列表不可访问。', 404)
  }

  return new GithubApiError(`GitHub API 请求失败，状态码：${response.status}。`, response.status)
}

// 根据 Stars 数和最近推送时间推断项目成熟度（early/growth/mature/stalled）
function inferMaturity(stars: number, pushedAt: string): ProjectMaturity {
  const inactiveDays = (Date.now() - new Date(pushedAt).getTime()) / 86_400_000

  if (inactiveDays > 365) {
    return 'stalled'
  }

  if (stars >= 10_000) {
    return 'mature'
  }

  if (stars >= 1_000) {
    return 'growth'
  }

  return 'early'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

export class GithubApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'GithubApiError'
    this.status = status
  }
}
