// 🔰 POST /api/projects/search — 搜索高价值项目库，支持关键词、语言、成熟度等筛选
import { ZodError } from 'zod'
import { resolveErrorMessage } from '@/lib/api-response'
import { handleZodError } from '@/lib/api-validation'
import { listCollectedSourceGithubUsernames, searchProjectsFromDatabase } from '@/lib/projects-repository'
import { searchProjectsSchema } from '@/validations/api-schemas'
import type { SearchProjectsResponse } from '@/types/insight-radar'

export async function POST(req: Request) {
  try {
    const body = searchProjectsSchema.parse(await req.json())
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
// 🔰 查询所有已采集的来源 GitHub 账号，供前端筛选下拉框使用
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
    if (error instanceof ZodError) return handleZodError(error)

    const response: SearchProjectsResponse = {
      projects: [],
      totalCount: 0,
      sources: [],
      error: resolveErrorMessage(error, '项目搜索失败，请稍后重试。'),
    }

    return Response.json(response, { status: 500 })
  }
}
