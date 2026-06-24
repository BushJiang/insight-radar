import { createHash } from 'crypto'
import type { GithubProject } from '@/types/insight-radar'

export function buildProfileHash(project: GithubProject) {
  // 获取日期并统一转为无毫秒 ISO 格式，避免不同来源（GitHub API / PostgreSQL / Date.toISOString）格式差异导致 hash 不一致
  const rawDate = project.githubUpdatedAt ?? project.updatedAt ?? ''
  const normalizedDate = new Date(rawDate).toISOString().replace(/\.\d{3}Z$/, 'Z')

  return createHash('sha256')
    .update([
      project.repositoryId,
      project.name,
      project.fullName,
      project.description,
      project.projectSummary ?? '',
      project.language,
      project.maturity,
      project.sourceGithubUsername,
      normalizedDate,
    ].join('\n'))
    .digest('hex')
}
