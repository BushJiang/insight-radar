import { resolveErrorMessage } from '@/lib/api-response'
import { clearAllProjects } from '@/lib/projects-repository'
import { clearProjectProfileVectors } from '@/lib/project-vector-store'

interface ClearDataResponseBody {
  ok: boolean
  error: string | null
}

export async function POST() {
  try {
    await clearProjectProfileVectors()
    await clearAllProjects()

    const response: ClearDataResponseBody = {
      ok: true,
      error: null,
    }

    return Response.json(response)
  } catch (error) {
    const response: ClearDataResponseBody = {
      ok: false,
      error: resolveErrorMessage(error, '清空数据失败，请稍后重试。'),
    }

    return Response.json(response, { status: 500 })
  }
}
