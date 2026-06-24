// API 校验工具：处理 Zod 校验错误，返回 400 + 字段级别的错误详情
import { ZodError } from 'zod'

export function handleZodError(error: ZodError) {
  return Response.json(
    { error: '输入参数校验失败', details: error.flatten().fieldErrors },
    { status: 400 },
  )
}
