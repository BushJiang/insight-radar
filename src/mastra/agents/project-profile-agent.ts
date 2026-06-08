// Agent instructions 是系统级护栏，定义智能体身份和不可违反的基本规则，用户无法通过页面修改。
// 用户在 /settings 页面保存的 projectProfileAgentPrompt 存储在 localStorage，运行时通过
// agent.generate(userPrompt) 传入，与 instructions 叠加后一起发给模型。前后两层都生效。
// default-preference.ts 中的 defaultProjectProfileAgentPrompt 仅作为新用户首次访问时的兜底默认值。
import { Agent } from '@mastra/core/agent'

export const projectProfileAgent = new Agent({
  id: 'project-profile-agent',
  name: '项目简介生成智能体',
  instructions: `
你是智源雷达的项目简介生成智能体。

工作规则：
- 只基于用户提供的项目信息生成简介。
- 不要编造项目信息中不存在的内容。
- 只输出简介正文，不要返回 JSON、标题或 Markdown 格式。
`,
  model: 'deepseek/deepseek-v4-flash',
})
