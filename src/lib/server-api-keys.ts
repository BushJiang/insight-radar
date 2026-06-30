import { ModelRouterLanguageModel } from '@mastra/core/llm'
import { getRuntimeApiKeys } from '@/lib/app-settings-service'

export async function resolveDeepSeekModel(modelId: string) {
  const apiKeys = await getRuntimeApiKeys()
  const apiKey = apiKeys.deepseekApiKey.trim()

  if (!apiKey) return `deepseek/${modelId}`

  return new ModelRouterLanguageModel({
    providerId: 'deepseek',
    modelId,
    apiKey,
    url: 'https://api.deepseek.com',
  })
}
