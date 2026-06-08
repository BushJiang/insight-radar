import { mastra } from '../src/mastra'
import { getProjectByRepositoryId } from '../src/lib/projects-repository'
import { getDefaultPreference, normalizePreference } from '../src/lib/default-preference'

const project = await getProjectByRepositoryId('749703336')
if (!project) { console.log('不存在'); process.exit(1) }

const preference = normalizePreference(getDefaultPreference())
const prompt = preference.projectProfileAgentPrompt

// 使用真实的 buildProjectProfilePrompt 逻辑
const raw = project.readmeContent || ''
const cleaned = raw.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim()
const readme = cleaned.slice(0, 500)
const fullPrompt = `${prompt}\n\n变量：\n- 项目名称：${project.name}\n- 仓库全名：${project.fullName}\n- 项目描述：${project.description}\n- 主要语言：${project.language}\n- README：${readme}`

console.log('prompt长度:', fullPrompt.length)
console.log('README slice:', readme.length)

const agent = mastra.getAgent('projectProfileAgent')
const result = await agent.generate(fullPrompt, {
  modelSettings: { maxOutputTokens: 1024, temperature: 0.2 },
})

console.log('text_len:', result.text?.length ?? 0)
console.log('text:', JSON.stringify(result.text?.slice(0, 150)))
console.log('finishReason:', result.finishReason)
