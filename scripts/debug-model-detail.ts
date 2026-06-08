import { mastra } from '../src/mastra'
import { getProjectByRepositoryId } from '../src/lib/projects-repository'

const project = await getProjectByRepositoryId('749703336')
if (!project) { console.log('不存在'); process.exit(1) }

const prompt = `请根据项目名称 {projectName}、仓库全名 {repositoryFullName}、项目描述 {projectDescription}、主要语言 {primaryLanguage} 和 README 文档 {readme}，生成不超过 200 字的中文项目简介。`

const raw = project.readmeContent || ''
const cleaned = raw.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500)
const fullPrompt = `${prompt}\n\n变量：\n- 项目名称：${project.name}\n- 仓库全名：${project.fullName}\n- 项目描述：${project.description}\n- 主要语言：${project.language}\n- README：${cleaned}`

console.log('prompt长度:', fullPrompt.length)

// 测试不同 maxOutputTokens
for (const tokens of [320, 512, 1024, 2048]) {
  const agent = mastra.getAgent('projectProfileAgent')
  const result = await agent.generate(fullPrompt, {
    modelSettings: { maxOutputTokens: tokens, temperature: 0.2 },
  })
  console.log(`maxOutputTokens=${tokens}: text_len=${result.text?.length ?? 0}, finishReason=${result.finishReason}, text=${JSON.stringify(result.text?.slice(0, 50))}`)
}
