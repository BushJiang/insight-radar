// POST /api/recommendations — 智能推荐：由 Mastra workflow 编排推荐阶段，并继续按行流式返回前端进度
import { ZodError } from 'zod'
import { handleZodError } from '@/lib/api-validation'
import { getRuntimePreference } from '@/lib/app-settings-service'
import { createJsonLineSender, jsonLineResponseHeaders, resolveMastraWorkflowProgressStep } from '@/lib/mastra-workflow-stream'
import { mastra } from '@/mastra'
import { recommendationRequestSchema } from '@/validations/api-schemas'

export async function POST(req: Request) {
  try {
    const body = recommendationRequestSchema.parse(await req.json())
    const preference = await getRuntimePreference(body.preference)

    const stream = new ReadableStream({
      async start(controller) {
        const send = createJsonLineSender(controller)

        try {
          const workflow = mastra.getWorkflow('projectRecommendationWorkflow')
          const run = await workflow.createRun()
          const workflowStream = run.stream({
            inputData: {
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
            },
          })
          const emittedSteps = new Set<string>()

          for await (const chunk of workflowStream) {
            const step = resolveMastraWorkflowProgressStep(chunk, { search: 'search', analysis: 'analysis', reasons: 'reasons' })
            if (step && !emittedSteps.has(step)) {
              emittedSteps.add(step)
              send({ type: 'progress', step })
            }
          }

          const result = await workflowStream.result

          if (result.status !== 'success') {
            send({ type: 'error', error: '智能推荐失败，请稍后重试。' })
            return
          }

          send({ type: 'result', ...result.result, error: null })
        } catch (error) {
          send({ type: 'error', error: error instanceof Error ? error.message : '智能推荐失败，请稍后重试。' })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: jsonLineResponseHeaders,
    })
  } catch (error) {
    if (error instanceof ZodError) return handleZodError(error)

    return Response.json({
      progress: { status: 'failed', completedCount: 0, totalCount: 0, message: '智能推荐失败，请稍后重试。' },
      recommendation: null,
      projects: [],
      error: error instanceof Error ? error.message : '智能推荐失败，请稍后重试。',
    }, { status: 500 })
  }
}
