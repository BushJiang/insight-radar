import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

const projectSchema = z.object({
  fullName: z.string(),
  description: z.string(),
  language: z.string(),
  stars: z.number(),
  sourceGithubUsername: z.string(),
  sourceUrl: z.string(),
  matchReason: z.string(),
})

const projects = [
  {
    fullName: 'mastra-ai/mastra',
    description: '用于构建 TypeScript AI 智能体和工作流的框架。',
    language: 'TypeScript',
    stars: 15400,
    sourceGithubUsername: 'vercel-ai-expert',
    sourceUrl: 'https://github.com/mastra-ai/mastra',
    matchReason: '匹配 TypeScript 智能体框架偏好，且具备 Agent、Workflow、Tool 能力。',
  },
  {
    fullName: 'drizzle-team/drizzle-orm',
    description: 'TypeScript ORM，适合关系型数据库类型安全访问。',
    language: 'TypeScript',
    stars: 28600,
    sourceGithubUsername: 'ts-infra-leader',
    sourceUrl: 'https://github.com/drizzle-team/drizzle-orm',
    matchReason: '匹配 PostgreSQL 与 TypeScript 技术栈。',
  },
  {
    fullName: 'better-auth/better-auth',
    description: '面向 TypeScript 应用的认证框架。',
    language: 'TypeScript',
    stars: 9200,
    sourceGithubUsername: 'nextjs-architect',
    sourceUrl: 'https://github.com/better-auth/better-auth',
    matchReason: '匹配用户认证、会话和偏好权限保护约束。',
  },
]

export const projectLibraryTool = createTool({
  id: 'search-project-library',
  description: '在智源雷达的高价值项目库示例数据中搜索项目，并返回可追溯来源。',
  inputSchema: z.object({
    query: z.string().describe('用户的搜索或项目需求'),
    language: z.string().optional().describe('可选语言过滤条件'),
    domainPreference: z.string().optional().describe('用户在偏好设置中选择的领域，用于推荐提示词，不作为项目固定分类'),
  }),
  outputSchema: z.object({
    projects: z.array(projectSchema),
  }),
  execute: async (inputData) => {
    const query = inputData.query.toLowerCase()
    const language = inputData.language?.toLowerCase()
    const domainPreference = inputData.domainPreference?.toLowerCase() ?? ''

    const matchedProjects = projects.filter((project) => {
      const text = `${project.fullName} ${project.description} ${project.language} ${project.matchReason} ${domainPreference}`.toLowerCase()
      const matchesQuery = !query || text.includes(query)
      const matchesLanguage = !language || project.language.toLowerCase() === language

      return matchesQuery && matchesLanguage
    })

    return { projects: matchedProjects.length > 0 ? matchedProjects : projects }
  },
})
