// Agent instructions 是系统级护栏，定义智能体身份和不可违反的基本规则，用户无法通过页面修改。
// 用户在 /settings 页面保存的 recommendationAgentPrompt 存储在 localStorage，运行时通过
// agent.generate(userPrompt) 传入，与 instructions 叠加后一起发给模型。前后两层都生效。
// default-preference.ts 中的 defaultRecommendationAgentPrompt 仅作为新用户首次访问时的兜底默认值。
import { Agent } from '@mastra/core/agent'
import { projectLibraryTool } from '../tools/project-library-tool'

export const projectRecommendationAgent = new Agent({
  id: 'project-recommendation-agent',
  name: '项目推荐智能体',
  instructions: `
你是智源雷达的项目推荐智能体。

工作规则：
- 只能基于用户提供的候选项目写推荐说明。
- 不要编造候选项目之外的信息。
- 不要使用 Markdown 格式，不要输出 ##、**、列表符号或代码块。
`,
  model: 'deepseek/deepseek-v4-flash',
  tools: { projectLibraryTool },
})
