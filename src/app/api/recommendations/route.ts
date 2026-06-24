// POST /api/recommendations — 智能推荐：向量语义搜索候选项目 + Mastra Agent 生成推荐理由
import { ZodError } from 'zod'
import { resolveErrorMessage } from '@/lib/api-response'
import { handleZodError } from '@/lib/api-validation'
import { normalizePreference } from '@/lib/default-preference'
import { generateProjectRecommendations } from '@/lib/recommendation-service'
import { recommendationRequestSchema } from '@/validations/api-schemas'
import type { ProjectProfileProgress, RecommendationExplanation, GithubProject } from '@/types/insight-radar'

// RecommendationResponseBody 是推荐 API 返回给前端的统一结构：简介进度、推荐解释、候选项目和错误信息
interface RecommendationResponseBody {
  progress: ProjectProfileProgress
  recommendation: RecommendationExplanation | null
  projects: GithubProject[]
  error: string | null
}

// POST 执行地图：
// 1. 读取并校验前端推荐请求体，过滤掉不合法的筛选条件和推荐数量
// 2. 归一化用户偏好，保证推荐服务拿到完整 prompt、领域和候选数量配置
// 3. 调用 generateProjectRecommendations 进入推荐服务主流程
// 4. 成功时把服务层结果包装成前端需要的响应结构
// 5. 校验失败或服务异常时返回可展示的错误响应
export async function POST(req: Request) {
  try {
    // 1. 读取并校验前端推荐请求体，过滤掉不合法的筛选条件和推荐数量
    const body = recommendationRequestSchema.parse(await req.json())
    // 2. 归一化用户偏好，保证推荐服务拿到完整 prompt、领域和候选数量配置
    const preference = normalizePreference(body.preference)
    // 3. 调用 generateProjectRecommendations 进入推荐服务主流程
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

    // 4. 成功时把服务层结果包装成前端需要的响应结构
    return Response.json(response)
  } catch (error) {
    if (error instanceof ZodError) return handleZodError(error)

    // 5. 校验失败或服务异常时返回可展示的错误响应
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
