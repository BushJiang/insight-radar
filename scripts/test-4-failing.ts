import { mastra } from '../src/mastra'
import { getProjectByRepositoryId } from '../src/lib/projects-repository'

const names = ['Andyyyy64/whichllm', 'tracel-ai/burn-lm', 'OpenBMB/MiniCPM', 'withastro/flue']

const prompt = `请根据项目名称 {projectName}、仓库全名 {repositoryFullName}、项目描述 {projectDescription}、主要语言 {primaryLanguage} 和 README 文档 {readme}，生成不超过 200 字的中文项目简介。简介需要说明项目解决的问题、核心能力、适用场景和主要技术栈，必须是完整句子，不能在句中截断。`

for (const fullName of names) {
  const project = await getProjectByRepositoryId(fullName.includes('whichllm') ? 'Andyyyy64/whichllm' : fullName.includes('burn-lm') ? 'tracel-ai/burn-lm' : fullName.includes('MiniCPM') ? 'OpenBMB/MiniCPM' : 'withastro/flue')
  
  // Actually, let me query differently since getProjectByRepositoryId needs numeric ID
}

// 用 SQL 查 ID 再测
import { spawnSync } from 'child_process'
for (const fn of names) {
  const r = spawnSync('psql', ['-t', '-c', `SELECT repository_id, name, full_name, description, language, readme_content FROM projects WHERE full_name = '${fn}' AND deleted_at IS NULL;`, 'postgres://bushjiang@localhost:5432/insightradar'])
  const parts = r.stdout.toString().trim().split('|').map(s => s.trim())
  if (parts.length < 6) { console.log(`${fn}: 不存在`); continue }
  
  const [repoId, name, fullName, description, language, readmeRaw] = parts
  const readmeContent = readmeRaw === '' ? null : readmeRaw
  
  const raw = readmeContent || ''
  const cleaned = raw.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim()
  const readme = cleaned.slice(0, 1500)
  
  const fullPrompt = `${prompt}\n\n变量：\n- 项目名称：${name}\n- 仓库全名：${fullName}\n- 项目描述：${description}\n- 主要语言：${language}\n- README：${readme}`
  
  const agent = mastra.getAgent('projectProfileAgent')
  const result = await agent.generate(fullPrompt, {
    modelSettings: { maxOutputTokens: 320, temperature: 0.2 },
  })
  
  console.log(`${fullName}: prompt=${fullPrompt.length}chars, text_len=${result.text?.length ?? 0}, text=${JSON.stringify(result.text?.slice(0, 80))}, finishReason=${result.finishReason}`)
}
