import { createHash } from 'crypto'
import type { GithubProject } from '@/types/insight-radar'

export function buildProfileHash(project: GithubProject) {
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
      project.githubUpdatedAt ?? project.updatedAt,
    ].join('\n'))
    .digest('hex')
}
