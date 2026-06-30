type WorkflowProgressEvent = {
  type?: string
  step?: string
}

type WorkflowStreamEvent = {
  type?: string
  payload?: {
    id?: string
    output?: unknown
  }
  step?: string
}

export const jsonLineResponseHeaders = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'no-cache',
}

export function createJsonLineSender(controller: ReadableStreamDefaultController<Uint8Array>) {
  const encoder = new TextEncoder()

  return (data: Record<string, unknown>) => {
    controller.enqueue(encoder.encode(`${JSON.stringify(data)}\n`))
  }
}

export function resolveMastraWorkflowProgressStep(chunk: unknown, stepStartMap: Record<string, string> = {}) {
  if (!chunk || typeof chunk !== 'object') return null

  const event = chunk as WorkflowStreamEvent
  if (event.type === 'progress' && event.step) return event.step

  if (event.type === 'workflow-step-output') {
    return resolveProgressOutputStep(event.payload?.output)
  }

  if (event.type !== 'workflow-step-start') return null
  if (!event.payload?.id) return null

  return stepStartMap[event.payload.id] ?? null
}

function resolveProgressOutputStep(output: unknown) {
  if (!output || typeof output !== 'object') return null

  const progress = output as WorkflowProgressEvent
  if (progress.type === 'progress' && progress.step) return progress.step

  return null
}
