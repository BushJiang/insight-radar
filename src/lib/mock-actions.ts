import { mockProjects } from '@/data/mock-insight-radar'
import type { CollectionJob, GithubProject, ProjectSearchFilters, RecommendationExplanation, UserPreference } from '@/types/insight-radar'

const githubUsernamePattern = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/

export function validateGithubUsername(username: string) {
  const value = username.trim()

  if (!value) {
    return '请输入 GitHub 用户名。'
  }

  if (value.includes(',') || value.includes(' ') || value.includes('/')) {
    return '一次只能输入一个 GitHub 用户名。'
  }

  if (!githubUsernamePattern.test(value)) {
    return 'GitHub 用户名格式不正确。'
  }

  return null
}

export function createMockCollectionJob(githubUsername: string): CollectionJob {
  const now = new Date().toISOString()

  if (githubUsername.toLowerCase() === 'unknown-user') {
    return {
      id: `job-${Date.now()}`,
      githubUsername,
      status: 'failed',
      startedAt: now,
      finishedAt: now,
      createdProjectCount: 0,
      duplicateProjectCount: 0,
      updatedProjectCount: 0,
      failedCount: 1,
      errorMessage: 'GitHub 账号不存在或当前不可访问。',
      rateLimitResetAt: null,
    }
  }

  return {
    id: `job-${Date.now()}`,
    githubUsername,
    status: 'success',
    startedAt: now,
    finishedAt: new Date(Date.now() + 90_000).toISOString(),
    createdProjectCount: 3,
    duplicateProjectCount: 0,
    updatedProjectCount: 1,
    failedCount: 0,
    errorMessage: null,
    rateLimitResetAt: null,
  }
}

export function searchMockProjects(projects: GithubProject[], filters: ProjectSearchFilters) {
  const query = filters.query.trim().toLowerCase()
  const now = Date.now()

  return projects.filter((project) => {
    const searchable = `${project.fullName} ${project.name} ${project.description} ${project.topics.join(' ')}`.toLowerCase()
    const matchesQuery = !query || searchable.includes(query)
    const matchesLanguage = filters.languages.length === 0 || filters.languages.includes(project.language)
    const matchesSource = !filters.sourceGithubUsername || project.sourceGithubUsername === filters.sourceGithubUsername
    const matchesDays = !filters.days || now - new Date(project.starAt).getTime() <= filters.days * 24 * 60 * 60 * 1000

    return matchesQuery && matchesLanguage && matchesSource && matchesDays
  })
}

export function generateMockRecommendation(projects: GithubProject[], preference: UserPreference, query: string): RecommendationExplanation {
  const selectedProjects = projects.length > 0 ? projects : mockProjects.slice(0, 1)
  const confidence = selectedProjects.every((project) => project.sourceUrl) ? 'high' : 'low'

  return {
    id: `rec-${Date.now()}`,
    projectIds: selectedProjects.map((project) => project.repositoryId),
    query: query || `基于 ${preference.domains.join('、')} 和 ${preference.languages.join('、')} 偏好推荐项目`,
    facts: selectedProjects.map((project) => `${project.fullName} 的主要语言是 ${project.language}，来源账号是 ${project.sourceGithubUsername}。`),
    inferences: selectedProjects.map((project) => `${project.fullName} 的匹配理由是：${project.matchReason}`),
    suggestions: [
      `当前推荐目的为“${formatIntent(preference.intent)}”，建议先查看 README、最近提交和 Issue 活跃度。`,
      '如果用于生产引入，需要继续检查许可证、发布节奏和社区维护状态。',
    ],
    sources: selectedProjects.map((project) => project.sourceUrl),
    confidence,
    createdAt: new Date().toISOString(),
  }
}

export function formatIntent(intent: UserPreference['intent']) {
  const labels: Record<UserPreference['intent'], string> = {
    learning: '学习',
    production: '生产使用',
    contribution: '参与贡献',
    selection: '技术选型',
    risk: '风险判断',
  }

  return labels[intent]
}

export function formatDate(value: string | null) {
  if (!value) {
    return '未完成'
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
