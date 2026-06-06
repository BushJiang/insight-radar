import { normalizePreference } from '@/lib/default-preference'
import { generateProjectRecommendations } from '@/lib/recommendation-service'
import type { ProjectProfileProgress, RecommendationExplanation, UserPreference, GithubProject } from '@/types/insight-radar'

interface RecommendationRequestBody {
  query: string
  filters: {
    query?: string
    languages?: string[]
    maturity?: Array<'early' | 'growth' | 'mature' | 'stalled'>
    sourceGithubUsername?: string | null
    days?: number | null
  }
  recommendationLimit: number
  preference?: Partial<UserPreference>
}

interface RecommendationResponseBody {
  progress: ProjectProfileProgress
  recommendation: RecommendationExplanation | null
  projects: GithubProject[]
  error: string | null
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as RecommendationRequestBody
    const preference = normalizePreference(body.preference)
    const recommendationLimit = Math.max(1, Math.min(50, Number(body.recommendationLimit) || 4))
    const result = await generateProjectRecommendations({
      query: body.query.trim(),
      filters: {
        query: '',
        languages: body.filters.languages ?? [],
        maturity: body.filters.maturity ?? [],
        sourceGithubUsername: body.filters.sourceGithubUsername ?? null,
        days: body.filters.days ?? null,
      },
      recommendationLimit,
      preference,
    })
    const response: RecommendationResponseBody = {
      ...result,
      error: null,
    }

    return Response.json(response)
  } catch (error) {
    const response: RecommendationResponseBody = {
      progress: {
        status: 'failed',
        completedCount: 0,
        totalCount: 0,
        message: error instanceof Error ? error.message : '智能推荐失败，请稍后重试。',
      },
      recommendation: null,
      projects: [],
      error: error instanceof Error ? error.message : '智能推荐失败，请稍后重试。',
    }

    return Response.json(response, { status: 500 })
  }
}
