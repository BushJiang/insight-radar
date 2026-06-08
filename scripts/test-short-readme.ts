import { mastra } from '../src/mastra'
import { getProjectByRepositoryId } from '../src/lib/projects-repository'

const project = await getProjectByRepositoryId('1156956890')

if (!project) { console.log('项目不存在'); process.exit(1) }

const prompt = `请根据项目名称 {projectName}、仓库全名 {repositoryFullName}、项目描述 {projectDescription}、主要语言 {primaryLanguage} 和 README 文档 {readme}，生成不超过 200 字的中文项目简介。简介需要说明项目解决的问题、核心能力、适用场景和主要技术栈，必须是完整句子，不能在句中截断。`

// 测试不同的 README 截取长度
for (const sliceLen of [2000, 3000, 4000, 5000, 8000]) {
  const readme = project.readmeContent ? project.readmeContent.slice(0, sliceLen) : '暂无 README。'
  const fullPrompt = `${prompt}\n\n变量：\n- 项目名称：${project.name}\n- 仓库全名：${project.fullName}\n- 项目描述：${project.description}\n- 主要语言：${project.language}\n- README：${readme}`
  
  const agent = mastra.getAgent('projectProfileAgent')
  const result = await agent.generate(fullPrompt, {
    modelSettings: { maxOutputTokens: 320, temperature: 0.2 },
  })
  console.log(`slice=${sliceLen}, prompt=${fullPrompt.length}chars, result.text 长度=${result.text?.length ?? 0}, 值=${JSON.stringify(result.text?.slice(0, 60))}`)
}
