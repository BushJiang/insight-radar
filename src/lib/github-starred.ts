import { persistCollectedProjects, searchProjectsFromDatabase } from '@/lib/projects-repository'
import type { GithubProject, GithubStarredSearchResponse, ProjectMaturity, ProjectSearchFilters } from '@/types/insight-radar'

const githubStarredPageSize = 100
const defaultMaxFetchedRepositories = 500

interface GithubStarredRepository {
  starred_at: string
  repo: {
    id: number
    name: string
    full_name: string
    description: string | null
    html_url: string
    default_branch?: string
    language: string | null
    stargazers_count: number
    forks_count: number
    open_issues_count: number
    updated_at: string
    pushed_at: string | null
    topics?: string[]
    license?: { spdx_id: string | null; name: string | null } | null
    fork: boolean
    source?: { full_name: string; html_url: string } | null
    parent?: { full_name: string; html_url: string } | null
  }
}

interface FetchStarredRepositoriesResult {
  repositories: GithubStarredRepository[]
  estimatedTotalCount: number | null
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

  const { repositories, estimatedTotalCount } = await fetchStarredRepositories(username, filters.days, maxProjects ?? defaultMaxFetchedRepositories, githubToken?.trim())
  const collectedProjects = await Promise.all(repositories.map((repository) => mapRepositoryToProject(repository, username, githubToken?.trim())))
  const persistedResult = await persistCollectedProjects(collectedProjects)
  const projects = filters.query.trim()
    ? (await searchProjectsFromDatabase({
      query: filters.query,
      languages: filters.languages,
      maturity: filters.maturity,
      sourceGithubUsername: filters.sourceGithubUsername,
      days: filters.days,
      page: 1,
      pageSize: repositories.length || 1,
    })).projects
    : collectedProjects

  return {
    projects,
    totalCount: projects.length,
    fetchedCount: repositories.length,
    duplicateCount: persistedResult.duplicateCount,
    updatedDuplicateCount: persistedResult.updatedDuplicateCount,
    unchangedDuplicateCount: persistedResult.unchangedDuplicateCount,
    estimatedTotalCount,
    rateLimitRemaining: null,
    rateLimitResetAt: null,
    error: null,
  }
}

async function fetchStarredRepositories(username: string, days: number | null, maxProjects: number, githubToken?: string): Promise<FetchStarredRepositoriesResult> {
  const repositories: GithubStarredRepository[] = []
  const cutoff = days ? Date.now() - days * 24 * 60 * 60 * 1000 : null
  const fetchLimit = maxProjects === 0 ? Number.POSITIVE_INFINITY : Math.max(1, maxProjects)
  let estimatedTotalCount: number | null = null

  for (let page = 1; repositories.length < fetchLimit; page += 1) {
    const url = new URL(`https://api.github.com/users/${encodeURIComponent(username)}/starred`)
    url.searchParams.set('sort', 'created')
    url.searchParams.set('direction', 'desc')
    url.searchParams.set('per_page', String(githubStarredPageSize))
    url.searchParams.set('page', String(page))

    const response = await fetch(url, {
      headers: buildGithubHeaders(githubToken),
      next: { revalidate: 300 },
    })

    if (!response.ok) {
      throw await buildGithubError(response)
    }

    const pageItems = await response.json() as GithubStarredRepository[]

    if (page === 1) {
      estimatedTotalCount = estimateTotalCount(response.headers.get('Link'), pageItems.length, fetchLimit)
    }

    if (pageItems.length === 0) {
      break
    }

    for (const item of pageItems) {
      if (cutoff && new Date(item.starred_at).getTime() < cutoff) {
        return { repositories, estimatedTotalCount: repositories.length }
      }

      repositories.push(item)

      if (repositories.length >= fetchLimit) {
        break
      }
    }

    if (pageItems.length < githubStarredPageSize) {
      break
    }
  }

  return { repositories, estimatedTotalCount: estimatedTotalCount ?? repositories.length }
}

function estimateTotalCount(linkHeader: string | null, firstPageCount: number, fetchLimit: number) {
  if (firstPageCount === 0) {
    return 0
  }

  const lastPageMatch = linkHeader?.match(/[?&]page=(\d+)[^>]*>; rel="last"/)
  const rawTotal = lastPageMatch ? Number(lastPageMatch[1]) * githubStarredPageSize : firstPageCount

  if (!Number.isFinite(fetchLimit)) {
    return rawTotal
  }

  return Math.min(rawTotal, fetchLimit)
}

function buildGithubHeaders(githubToken?: string) {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.star+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }

  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`
  }

  return headers
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

async function mapRepositoryToProject(item: GithubStarredRepository, username: string, githubToken?: string): Promise<GithubProject> {
  const repo = item.repo
  const language = repo.language || '其他'
  const sourceRepository = repo.source ?? repo.parent ?? null
  const readmeContent = await fetchReadmeContent(repo.full_name, repo.default_branch ?? 'main', githubToken)

  return {
    repositoryId: String(repo.id),
    fullName: repo.full_name,
    name: repo.name,
    description: repo.description || '暂无描述',
    language,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    issues: repo.open_issues_count,
    updatedAt: repo.updated_at,
    githubUpdatedAt: repo.updated_at,
    pushedAt: repo.pushed_at,
    readmeSummary: null,
    readmeContent,
    topics: repo.topics ?? [],
    license: repo.license?.spdx_id || repo.license?.name || null,
    isFork: repo.fork,
    sourceRepositoryFullName: sourceRepository?.full_name ?? null,
    sourceRepositoryUrl: sourceRepository?.html_url ?? null,
    sourceGithubUsername: username,
    starAt: item.starred_at,
    sourceUrl: repo.html_url,
    matchReason: `${username} 在 ${formatDate(item.starred_at)} Star 了该项目。`,
    maturity: inferMaturity(repo.stargazers_count, repo.pushed_at ?? repo.updated_at),
    collectionJobId: `github-starred-${username}`,
  }
}

async function fetchReadmeContent(fullName: string, defaultBranch: string, githubToken?: string) {
  const url = `https://raw.githubusercontent.com/${fullName}/${defaultBranch}/README.md`
  const response = await fetch(url, {
    headers: githubToken ? { Authorization: `Bearer ${githubToken}` } : undefined,
    next: { revalidate: 3600 },
  })

  if (!response.ok) {
    return null
  }

  return response.text()
}

function inferMaturity(stars: number, pushedAt: string): ProjectMaturity {
  const inactiveDays = (Date.now() - new Date(pushedAt).getTime()) / 86_400_000

  // 成熟度只看两个信号：最近是否还活跃，以及 Star 是否达到常见影响力门槛。
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
