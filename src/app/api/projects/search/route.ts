import { resolveErrorMessage } from '@/lib/api-response'
import { listCollectedSourceGithubUsernames, searchProjectsFromDatabase } from '@/lib/projects-repository'
import type { SearchProjectsRequest, SearchProjectsResponse } from '@/types/insight-radar'

export async function POST(req: Request) {
  try {
    const body = await req.json() as SearchProjectsRequest
    const [{ projects, totalCount }, sources] = await Promise.all([
      searchProjectsFromDatabase({
        query: body.filters.query,
        languages: body.filters.languages,
        maturity: body.filters.maturity,
        sourceGithubUsername: body.filters.sourceGithubUsername,
        days: body.filters.days,
        page: body.page,
        pageSize: body.pageSize,
      }),
      listCollectedSourceGithubUsernames(),
    ])

    const response: SearchProjectsResponse = {
      projects,
      totalCount,
      sources,
      error: null,
    }

    return Response.json(response)
  } catch (error) {
    const response: SearchProjectsResponse = {
      projects: [],
      totalCount: 0,
      sources: [],
      error: resolveErrorMessage(error, '项目搜索失败，请稍后重试。'),
    }

    return Response.json(response, { status: 500 })
  }
}
