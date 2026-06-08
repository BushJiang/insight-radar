import { persistCollectedProjects, searchProjectsFromDatabase } from '@/lib/projects-repository'
import type { GithubProject, GithubStarredSearchResponse, ProjectMaturity, ProjectSearchFilters } from '@/types/insight-radar'

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

interface SearchGithubStarredProjectsOptions {
  filters: ProjectSearchFilters
  githubToken?: string
  maxProjects?: number
}

export async function searchGithubStarredProjects({ filters, githubToken, maxProjects }: SearchGithubStarredProjectsOptions): Promise<GithubStarredSearchResponse> {
  const username = filters.sourceGithubUsername?.trim()

  if (!username) {
    throw new GithubApiError('请输入来源账号后再搜索。', 400)
  }

  const { edges, totalCount } = await fetchStarredReposViaGraphql(username, filters.days, maxProjects ?? defaultMaxFetchedRepositories, githubToken?.trim())
  const collectedProjects = await Promise.all(edges.map((edge) => mapRepoEdgeToProject(edge, username, githubToken?.trim())))
  const persistedResult = await persistCollectedProjects(collectedProjects)
  const projects = filters.query.trim()
    ? (await searchProjectsFromDatabase({
      query: filters.query,
      languages: filters.languages,
      maturity: filters.maturity,
      sourceGithubUsername: filters.sourceGithubUsername,
      days: filters.days,
      page: 1,
      pageSize: edges.length || 1,
    })).projects
    : collectedProjects

  return {
    projects,
    totalCount: projects.length,
    fetchedCount: edges.length,
    duplicateCount: persistedResult.duplicateCount,
    updatedDuplicateCount: persistedResult.updatedDuplicateCount,
    unchangedDuplicateCount: persistedResult.unchangedDuplicateCount,
    estimatedTotalCount: totalCount,
    rateLimitRemaining: null,
    rateLimitResetAt: null,
    error: null,
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
    readmeSummary: null,
    readmeContent,
    topics: node.repositoryTopics.nodes.map((n) => n.topic.name),
    license: node.licenseInfo?.spdxId || node.licenseInfo?.name || null,
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

// README 通过 REST API 获取，可以正确处理任意文件名、大小写、子目录
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

  return response.text()
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
