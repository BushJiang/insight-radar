import { ZodError } from 'zod'

export function handleZodError(error: ZodError) {
  return Response.json(
    { error: '输入参数校验失败', details: error.flatten().fieldErrors },
    { status: 400 },
  )
}
