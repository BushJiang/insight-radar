import { ZodError } from 'zod'
import { resolveErrorMessage } from '@/lib/api-response'
import { handleZodError } from '@/lib/api-validation'
import { normalizePreference } from '@/lib/default-preference'
import { generateProjectRecommendations } from '@/lib/recommendation-service'
import { recommendationRequestSchema } from '@/validations/api-schemas'
import type { ProjectProfileProgress, RecommendationExplanation, GithubProject } from '@/types/insight-radar'

interface RecommendationResponseBody {
  progress: ProjectProfileProgress
  recommendation: RecommendationExplanation | null
  projects: GithubProject[]
  error: string | null
}

export async function POST(req: Request) {
  try {
    const body = recommendationRequestSchema.parse(await req.json())
    const preference = normalizePreference(body.preference)
    const result = await generateProjectRecommendations({
      query: body.query.trim(),
      filters: {
        query: '',
        languages: body.filters.languages ?? [],
        maturity: body.filters.maturity ?? [],
        sourceGithubUsername: body.filters.sourceGithubUsername ?? null,
        days: body.filters.days ?? null,
      },
      recommendationLimit: body.recommendationLimit,
      preference,
    })
    const response: RecommendationResponseBody = {
      ...result,
      error: null,
    }

    return Response.json(response)
  } catch (error) {
    if (error instanceof ZodError) return handleZodError(error)

    const response: RecommendationResponseBody = {
      progress: {
        status: 'failed',
        completedCount: 0,
        totalCount: 0,
        message: resolveErrorMessage(error, '智能推荐失败，请稍后重试。'),
      },
      recommendation: null,
      projects: [],
      error: resolveErrorMessage(error, '智能推荐失败，请稍后重试。'),
    }

    return Response.json(response, { status: 500 })
  }
}
