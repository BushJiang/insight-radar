// 项目推荐智能体：用 DeepSeek 模型根据用户需求从候选项目中生成推荐理由（Reasons/Facts/Inferences/Suggestions）。instructions 为系统护栏
// Agent instructions 是系统级护栏，定义智能体身份和不可违反的基本规则，用户无法通过页面修改。
// 用户在 /settings 页面保存的 recommendationAgentPrompt 存储在 localStorage，运行时通过
// agent.generate(userPrompt) 传入，与 instructions 叠加后一起发给模型。前后两层都生效。
// default-preference.ts 中的 defaultRecommendationAgentPrompt 仅作为新用户首次访问时的兜底默认值。
import { Agent } from '@mastra/core/agent'

export const projectRecommendationAgent = new Agent({
  id: 'project-recommendation-agent',
  name: '项目推荐智能体',
  instructions: `
你是项目推荐智能体。

工作规则：
- 只能基于用户提供的候选项目写推荐说明。
- 不要编造候选项目之外的信息。
- 必须只输出合法 JSON，不要输出解释文字、Markdown、代码块或列表符号。
- 每个项目只输出 repositoryId、fitReasons、riskReminder。
- fitReasons 必须正好 3 条，每条20字左右。
- riskReminder 必须 1 条，每条20字左右。
- JSON 顶层格式必须是 {"recommendations":[{"repositoryId":"项目ID","fitReasons":["理由1","理由2","理由3"],"riskReminder":"风险提醒"}]}。
`,
  model: 'deepseek/deepseek-v4-pro',
  defaultOptions: {
    providerOptions: {
      deepseek: {
        thinking: { type: "disabled" }
      }
    }
  }
})
