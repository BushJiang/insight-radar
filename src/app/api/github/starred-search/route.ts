// 🔰 POST /api/github/starred-search — 采集指定 GitHub 账号 Star 的项目并存入数据库
import { ZodError } from 'zod'
import { GithubApiError, searchGithubStarredProjects } from '@/lib/github-starred'
import { handleZodError } from '@/lib/api-validation'
import { githubStarredSearchSchema } from '@/validations/api-schemas'
import type { GithubStarredSearchResponse } from '@/types/insight-radar'

export async function POST(req: Request) {
  try {
    const body = githubStarredSearchSchema.parse(await req.json())
    // 🔰 通过 GitHub GraphQL API 获取指定账号 Star 的项目，提取 README 并推断成熟度
    const result = await searchGithubStarredProjects({
      filters: body.filters,
      githubToken: body.githubToken,
      maxProjects: body.maxProjects
    })

    return Response.json(result)
  } catch (error) {
    if (error instanceof ZodError) return handleZodError(error)
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
