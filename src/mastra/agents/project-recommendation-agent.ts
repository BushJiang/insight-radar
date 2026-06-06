import { Agent } from '@mastra/core/agent'
import { projectLibraryTool } from '../tools/project-library-tool'

export const projectRecommendationAgent = new Agent({
  id: 'project-recommendation-agent',
  name: '项目推荐智能体',
  instructions: `
你是智源雷达的项目推荐智能体，帮助程序员从高价值 GitHub 项目库中理解项目价值。

工作规则：
- 只能基于用户提供的候选项目写推荐说明。
- 不要编造候选项目之外的信息。
- 推荐理由不超过 200 字，必须是完整内容。
- 不要使用 Markdown 格式，不要输出 ##、**、列表符号或代码块。
- 输出格式固定为：推荐理由、适用场景、上手建议、风险提醒。
`,
  model: 'deepseek/deepseek-v4-flash',
  tools: { projectLibraryTool },
})
