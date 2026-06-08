// 模拟再生流程，精确检查每个环节
import { mastra } from '../src/mastra'
import { countProjectsForFilters, listProjectsForProfileRegeneration } from '../src/lib/projects-repository'
import { getDefaultPreference, normalizePreference } from '../src/lib/default-preference'

const filters = { query: '', languages: [] as string[], maturity: [] as any[], sourceGithubUsername: null, days: null }
const preference = normalizePreference(getDefaultPreference())
const totalCount = await countProjectsForFilters(filters)
console.log('总项目数:', totalCount)

// 查 MiniCPM 在不在第一批
const batch1 = await listProjectsForProfileRegeneration({ ...filters, excludeRepositoryIds: [], limit: 20 })
console.log('第一批数量:', batch1.length)
const minicpmInBatch1 = batch1.find(p => p.fullName === 'OpenBMB/MiniCPM')
console.log('MiniCPM 在第一批:', !!minicpmInBatch1)

if (!minicpmInBatch1) {
  const batch1Ids = batch1.map(p => p.repositoryId)
  const batch2 = await listProjectsForProfileRegeneration({ ...filters, excludeRepositoryIds: batch1Ids, limit: 20 })
  console.log('第二批数量:', batch2.length)
  const minicpmInBatch2 = batch2.find(p => p.fullName === 'OpenBMB/MiniCPM')
  console.log('MiniCPM 在第二批:', !!minicpmInBatch2)
  
  if (minicpmInBatch2) {
    console.log('\n=== 模拟再生 MiniCPM ===')
    console.log('name:', minicpmInBatch2.name)
    console.log('fullName:', minicpmInBatch2.fullName)
    console.log('description:', minicpmInBatch2.description)
    console.log('readmeContent 长度:', minicpmInBatch2.readmeContent?.length ?? 0)
    console.log('当前 readmeSummary:', minicpmInBatch2.readmeSummary)
    console.log('force 参数会传 true')
    console.log('!readmeSummary?.trim():', !minicpmInBatch2.readmeSummary?.trim())
    console.log('force || !trim:', true || !minicpmInBatch2.readmeSummary?.trim())
    
    // 实际调用 AI
    const prompt = preference.projectProfileAgentPrompt
    const raw = minicpmInBatch2.readmeContent || ''
    const cleaned = raw.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim()
    const readme = cleaned.slice(0, 1500)
    const fullPrompt = `${prompt}\n\n变量：\n- 项目名称：${minicpmInBatch2.name}\n- 仓库全名：${minicpmInBatch2.fullName}\n- 项目描述：${minicpmInBatch2.description}\n- 主要语言：${minicpmInBatch2.language}\n- README：${readme}`
    
    console.log('prompt 长度:', fullPrompt.length)
    
    const agent = mastra.getAgent('projectProfileAgent')
    console.log('agent model:', (agent as any).model || 'unknown')
    
    const result = await agent.generate(fullPrompt, {
      modelSettings: { maxOutputTokens: 320, temperature: 0.2 },
    })
    
    console.log('result.text 长度:', result.text?.length ?? 0)
    console.log('result.text 开头:', JSON.stringify(result.text?.slice(0, 100)))
    console.log('result.finishReason:', result.finishReason)
    
    // 模拟 resolveProjectProfile
    const profile = result.text?.trim()
    const finalProfile = profile || '暂无项目简介。'
    console.log('final profile:', finalProfile.slice(0, 100))
    console.log('是兜底吗:', finalProfile === '暂无项目简介。')
  }
}
