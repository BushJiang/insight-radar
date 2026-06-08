import { mastra } from '../src/mastra'

const agent = mastra.getAgent('projectProfileAgent')

const shortPrompt = '用中文回复：你好，请用一句话介绍人工智能。'

// 测试1：当前 maxOutputTokens=320
console.log('=== 测试1: maxOutputTokens=320 ===')
const r1 = await agent.generate(shortPrompt, {
  modelSettings: { maxOutputTokens: 320, temperature: 0.2 },
})
console.log('text:', JSON.stringify(r1.text))
console.log('finishReason:', r1.finishReason)
console.log('reasoningText长度:', r1.reasoningText?.length ?? 0)
console.log('')

// 测试2: maxOutputTokens=4096
console.log('=== 测试2: maxOutputTokens=4096 ===')
const r2 = await agent.generate(shortPrompt, {
  modelSettings: { maxOutputTokens: 4096, temperature: 0.2 },
})
console.log('text:', JSON.stringify(r2.text))
console.log('finishReason:', r2.finishReason)
console.log('reasoningText长度:', r2.reasoningText?.length ?? 0)
