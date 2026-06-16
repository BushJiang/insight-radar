// 🔰 API 响应工具：从 unknown error 中提取可读错误消息，所有 API 路由复用
export function resolveErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}
