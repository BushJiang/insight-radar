import { mastra } from '../src/mastra'
import { getProjectByRepositoryId } from '../src/lib/projects-repository'

// 和再生流程完全一致的方式获取项目数据
const project = await getProjectByRepositoryId('1156956890')

if (!project) {
  console.log('项目不存在')
  process.exit(1)
}

console.log('=== 项目信息 ===')
console.log('fullName:', project.fullName)
console.log('description:', project.description)
console.log('language:', project.language)
console.log('readmeContent 长度:', project.readmeContent?.length ?? 0)
console.log('readmeContent 前200字符:', project.readmeContent?.slice(0, 200))
console.log('')

const prompt = `请根据项目名称 {projectName}、仓库全名 {repositoryFullName}、项目描述 {projectDescription}、主要语言 {primaryLanguage} 和 README 文档 {readme}，生成不超过 200 字的中文项目简介。简介需要说明项目解决的问题、核心能力、适用场景和主要技术栈，必须是完整句子，不能在句中截断。`

const readme = project.readmeContent ? project.readmeContent.slice(0, 8000) : '暂无 README。'
const fullPrompt = `${prompt}

变量：
- 项目名称：${project.name}
- 仓库全名：${project.fullName}
- 项目描述：${project.description}
- 主要语言：${project.language}
- README：${readme}`

console.log('=== 提示词长度:', fullPrompt.length, '===\n')

const agent = mastra.getAgent('projectProfileAgent')
const result = await agent.generate(fullPrompt, {
  modelSettings: { maxOutputTokens: 320, temperature: 0.2 },
})

console.log('=== result.text:', JSON.stringify(result.text))
console.log('=== result.text 长度:', result.text?.length ?? 0)
