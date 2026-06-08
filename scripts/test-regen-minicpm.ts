import { mastra } from '../src/mastra'
import { countProjectsForFilters, listProjectsForProfileRegeneration, updateProjectProfile } from '../src/lib/projects-repository'
import { getDefaultPreference, normalizePreference } from '../src/lib/default-preference'

// 模拟再生流程，逐步检查
const filters = { query: '', languages: [] as string[], maturity: [] as any[], sourceGithubUsername: null, days: null }
const preference = normalizePreference(null)

console.log('=== Step 1: 加载 preference ===')
console.log('projectProfileAgentPrompt:', preference.projectProfileAgentPrompt.slice(0, 80) + '...')

console.log('\n=== Step 2: 查询项目列表 ===')
const totalCount = await countProjectsForFilters(filters)
console.log('总项目数:', totalCount)

const projects = await listProjectsForProfileRegeneration({ ...filters, excludeRepositoryIds: [], limit: 20 })
const miniCPM = projects.find(p => p.fullName === 'OpenBMB/MiniCPM')
console.log('MiniCPM 在列表中:', !!miniCPM)

if (miniCPM) {
  console.log('\n=== Step 3: 模拟 generateAndSaveProjectProfiles ===')
  
  const raw = miniCPM.readmeContent || ''
  const cleaned = raw.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim()
  const readme = cleaned.slice(0, 1500)
  const fullPrompt = `${preference.projectProfileAgentPrompt}\n\n变量：\n- 项目名称：${miniCPM.name}\n- 仓库全名：${miniCPM.fullName}\n- 项目描述：${miniCPM.description}\n- 主要语言：${miniCPM.language}\n- README：${readme}`
  
  console.log('prompt 长度:', fullPrompt.length)
  console.log('preference prompt 开头:', preference.projectProfileAgentPrompt.slice(0, 50))
  
  const agent = mastra.getAgent('projectProfileAgent')
  const result = await agent.generate(fullPrompt, {
    modelSettings: { maxOutputTokens: 320, temperature: 0.2 },
  })
  
  console.log('result.text 长度:', result.text?.length ?? 0)
  console.log('result.text:', JSON.stringify(result.text?.slice(0, 200)))
  
  // 模拟写入
  const profile = result.text?.trim() || '暂无项目简介。'
  console.log('\n=== Step 4: 模拟 DB 写入 ===')
  console.log('将写入的 profile:', profile.slice(0, 80))
}
