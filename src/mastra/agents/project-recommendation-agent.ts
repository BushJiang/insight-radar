import { Agent } from '@mastra/core/agent'
import { projectLibraryTool } from '../tools/project-library-tool'

export const projectRecommendationAgent = new Agent({
  id: 'project-recommendation-agent',
  name: '项目推荐智能体',
  instructions: `
你是智源雷达的项目推荐智能体，帮助程序员从高价值 GitHub 项目库中理解项目价值。

工作规则：
- 只能基于 search-project-library 工具返回的项目库数据推荐项目。
- 必须区分 GitHub 原始事实、系统推断和主观建议。
- 必须展示来源账号和来源链接。
- 如果来源不足，要明确标记低置信，不要把推断伪装成事实。
`,
  model: 'deepseek/deepseek-v4-flash',
  tools: { projectLibraryTool },
})
