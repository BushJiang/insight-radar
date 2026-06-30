// POST /api/github/starred-search — 采集 Star 项目：由 Mastra workflow 编排采集、保存和简介生成阶段
import { ZodError } from 'zod'
import { getRuntimeApiKeys, getRuntimePreference } from '@/lib/app-settings-service'
import { handleZodError } from '@/lib/api-validation'
import { resolveErrorMessage } from '@/lib/api-response'
import { createJsonLineSender, jsonLineResponseHeaders, resolveMastraWorkflowProgressStep } from '@/lib/mastra-workflow-stream'
import { mastra } from '@/mastra'
import { githubStarredSearchSchema } from '@/validations/api-schemas'

export async function POST(req: Request) {
  try {
    const body = githubStarredSearchSchema.parse(await req.json())
    const [apiKeys, preference] = await Promise.all([
      getRuntimeApiKeys(),
      getRuntimePreference(body.preference),
    ])

    const stream = new ReadableStream({
      async start(controller) {
        const send = createJsonLineSender(controller)

        try {
          const workflow = mastra.getWorkflow('githubStarCollectionWorkflow')
          const run = await workflow.createRun()
          const workflowStream = run.stream({
            inputData: {
              filters: body.filters,
              githubToken: apiKeys.githubToken,
              maxProjects: body.maxProjects,
              preference,
            },
          })
          const emittedSteps = new Set<string>()

          for await (const chunk of workflowStream) {
            const step = resolveMastraWorkflowProgressStep(chunk, { collectRepositoryData: 'fetch_stars' })
            if (step && !emittedSteps.has(step)) {
              emittedSteps.add(step)
              send({ type: 'progress', step })
            }
          }

          const result = await workflowStream.result

          if (result.status !== 'success') {
            send({ type: 'error', error: '项目搜索失败，请稍后重试。' })
            return
          }

          send({ type: 'result', ...result.result, error: null })
        } catch (error) {
          const message = resolveErrorMessage(error, '项目搜索失败，请稍后重试。')
          send({ type: 'error', error: message })
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
      projects: [],
      totalCount: 0,
      fetchedCount: 0,
      duplicateCount: 0,
      updatedDuplicateCount: 0,
      unchangedDuplicateCount: 0,
      estimatedTotalCount: null,
      rateLimitRemaining: null,
      rateLimitResetAt: null,
      error: '请求参数校验失败。',
    }, { status: 400 })
  }
}
