import { mastra } from '../src/mastra'
import { getProjectByRepositoryId } from '../src/lib/projects-repository'

const projectIds = [
  { id: '1015042900', name: 'deanpeters/Product-Manager-Skills' },
  { id: '1204876463', name: 'ekzhu/datasketch' },
  { id: '1102340385', name: 'FoxNoseTech/diarize' },
]

for (const { id, name } of projectIds) {
  const project = await getProjectByRepositoryId(id)
  if (!project) { console.log(`${name}: 不存在`); continue }

  const prompt = `请根据项目名称 {projectName}、仓库全名 {repositoryFullName}、项目描述 {projectDescription}、主要语言 {primaryLanguage} 和 README 文档 {readme}，生成不超过 200 字的中文项目简介。简介需要说明项目解决的问题、核心能力、适用场景和主要技术栈，必须是完整句子，不能在句中截断。`

  const rawReadme = project.readmeContent || ''
  const cleaned = rawReadme
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const readme = cleaned.slice(0, 1500)

  const fullPrompt = `${prompt}\n\n变量：\n- 项目名称：${project.name}\n- 仓库全名：${project.fullName}\n- 项目描述：${project.description}\n- 主要语言：${project.language}\n- README：${readme}`

  const agent = mastra.getAgent('projectProfileAgent')
  const result = await agent.generate(fullPrompt, {
    modelSettings: { maxOutputTokens: 320, temperature: 0.2 },
  })

  console.log(`${name}: prompt=${fullPrompt.length}chars, result.text 长度=${result.text?.length ?? 0}, 值=${JSON.stringify(result.text?.slice(0, 80))}`)
}
