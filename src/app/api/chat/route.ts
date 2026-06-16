// 🔰 POST /api/chat — Mastra AI 聊天流式接口，返回 SSE 流
import { handleChatStream } from '@mastra/ai-sdk'
import { createUIMessageStreamResponse } from 'ai'
import { mastra } from '@/mastra'

export async function POST(req: Request) {
  const params = await req.json()
  const stream = await handleChatStream({
    mastra,
    agentId: 'project-recommendation-agent',
    params,
    version: 'v6',
  })

  return createUIMessageStreamResponse({ stream })
}
