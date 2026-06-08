import { mastra } from '../src/mastra'

const agent = mastra.getAgent('projectProfileAgent')

// 用真实 README（模拟 zeroclaw 的前 8000 字符）
const realReadme = `ZeroClaw is an agent runtime — a single Rust binary you configure and run. It talks to LLM providers (Anthropic, OpenAI, Ollama, and ~20 others), reaches the world through 30+ channels (Discord, Telegram, Matrix, email, voice, webhooks, your own CLI), and acts through tools (shell, browser, HTTP, hardware, custom MCP servers). Everything runs on your machine, with your keys, in your workspace.

Read the Philosophy for the four opinions that shape it.
Fast & Small. No external dependencies. ZeroClaw fits in a small container, snap, or bare-metal binary. It works on Linux, macOS, and Windows. It runs on a Raspberry Pi.

The daemon binary is ~23 MB compressed, ~60 MB on disk.`

const fullPrompt = `请根据项目名称 {projectName}、仓库全名 {repositoryFullName}、项目描述 {projectDescription}、主要语言 {primaryLanguage} 和 README 文档 {readme}，生成不超过 200 字的中文项目简介。简介需要说明项目解决的问题、核心能力、适用场景和主要技术栈，必须是完整句子，不能在句中截断。

变量：
- 项目名称：zeroclaw
- 仓库全名：zeroclaw-labs/zeroclaw
- 项目描述：Autonomous AI agent that runs locally on your machine with your tools and credentials
- 主要语言：Rust
- README：${realReadme}`

console.log('=== 提示词长度:', fullPrompt.length, '===\n')

const result = await agent.generate(fullPrompt, {
  modelSettings: { maxOutputTokens: 320, temperature: 0.2 },
})

console.log('=== result.text 值:', JSON.stringify(result.text))
console.log('=== result.text 长度:', result.text?.length ?? 0)
