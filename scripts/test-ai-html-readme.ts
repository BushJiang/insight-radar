import { mastra } from '../src/mastra'

const agent = mastra.getAgent('projectProfileAgent')

// 用 DB 中实际存储的 README（HTML 格式，截取前 8000 字符）
const htmlReadme = `<p align="center">
  <img src="https://raw.githubusercontent.com/zeroclaw-labs/zeroclaw/master/docs/assets/zeroclaw-banner.png" alt="ZeroClaw" width="600" />
</p>
<h1 align="center">🦀 ZeroClaw — Personal AI Assistant</h1>
<p align="center">
  <strong>You own the agent. You own the data. You own the machine it runs on.</strong>
</p>
<p align="center">
  <a href="https://github.com/zeroclaw-labs/zeroclaw/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/zeroclaw-labs/zeroclaw/ci.yml?style=flat-square" alt="CI"></a>
</p>
<p>ZeroClaw is an agent runtime — a single Rust binary you configure and run. It talks to LLM providers (Anthropic, OpenAI, Ollama, and ~20 others), reaches the world through 30+ channels (Discord, Telegram, Matrix, email, voice, webhooks, your own CLI). Everything runs on your machine.</p>`

const fullPrompt = `请根据项目名称 {projectName}、仓库全名 {repositoryFullName}、项目描述 {projectDescription}、主要语言 {primaryLanguage} 和 README 文档 {readme}，生成不超过 200 字的中文项目简介。简介需要说明项目解决的问题、核心能力、适用场景和主要技术栈，必须是完整句子，不能在句中截断。

变量：
- 项目名称：zeroclaw
- 仓库全名：zeroclaw-labs/zeroclaw
- 项目描述：Autonomous AI agent that runs locally on your machine with your tools and credentials
- 主要语言：Rust
- README：${htmlReadme}`

console.log('=== 提示词长度:', fullPrompt.length, '===\n')

const result = await agent.generate(fullPrompt, {
  modelSettings: { maxOutputTokens: 320, temperature: 0.2 },
})

console.log('=== result.text 值:', JSON.stringify(result.text))
console.log('=== result.text 长度:', result.text?.length ?? 0)
