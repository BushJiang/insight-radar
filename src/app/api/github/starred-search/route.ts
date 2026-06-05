import { GithubApiError, searchGithubStarredProjects } from '@/lib/github-starred'
import type { GithubStarredSearchRequest, GithubStarredSearchResponse } from '@/types/insight-radar'

export async function POST(req: Request) {
  try {
    const body = await req.json() as GithubStarredSearchRequest
    const result = await searchGithubStarredProjects({ filters: body.filters, githubToken: body.githubToken, maxProjects: body.maxProjects })

    return Response.json(result)
  } catch (error) {
    const status = error instanceof GithubApiError ? error.status : 500
    const message = error instanceof Error ? error.message : '项目搜索失败，请稍后重试。'
    const response: GithubStarredSearchResponse = {
      projects: [],
      totalCount: 0,
      fetchedCount: 0,
      duplicateCount: 0,
      updatedDuplicateCount: 0,
      unchangedDuplicateCount: 0,
      estimatedTotalCount: null,
      rateLimitRemaining: null,
      rateLimitResetAt: null,
      error: message,
    }

    return Response.json(response, { status })
  }
}
