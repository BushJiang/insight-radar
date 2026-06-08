import { mastra } from '../src/mastra'

const agent = mastra.getAgent('projectProfileAgent')

const project = {
  name: 'hello-halo',
  fullName: 'openkursar/hello-halo',
  description: '7×24 Desktop AI Agent for Everyone.',
  language: 'Python',
  readmeContent: '暂无 README。'
}

const prompt = `请根据项目名称 {projectName}、仓库全名 {repositoryFullName}、项目描述 {projectDescription}、主要语言 {primaryLanguage} 和 README 文档 {readme}，生成不超过 200 字的中文项目简介。简介需要说明项目解决的问题、核心能力、适用场景和主要技术栈，必须是完整句子，不能在句中截断。`

const fullPrompt = `${prompt}

变量：
- 项目名称：${project.name}
- 仓库全名：${project.fullName}
- 项目描述：${project.description}
- 主要语言：${project.language}
- README：${project.readmeContent}`

console.log('=== 提示词长度:', fullPrompt.length, '===\n')

const result = await agent.generate(fullPrompt, {
  modelSettings: { maxOutputTokens: 320, temperature: 0.2 },
})

console.log('=== result keys:', Object.keys(result).join(', '))
console.log('=== result.text 值:', JSON.stringify(result.text))
console.log('=== result.text 长度:', result.text?.length ?? 0)
