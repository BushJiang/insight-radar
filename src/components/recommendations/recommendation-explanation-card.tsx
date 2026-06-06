import { ProjectCard } from '@/components/projects/project-card'
import { getDefaultPreference } from '@/lib/default-preference'
import type { GithubProject, RecommendationExplanation } from '@/types/insight-radar'

interface RecommendationExplanationCardProps {
  recommendation: RecommendationExplanation
  projects: GithubProject[]
}

export function RecommendationExplanationCard({ recommendation, projects }: RecommendationExplanationCardProps) {
  const projectMap = new Map(projects.map((project) => [project.repositoryId, project] as const))
  const selectedProjects = recommendation.projectIds
    .map((projectId) => projectMap.get(projectId))
    .filter((project): project is GithubProject => Boolean(project))

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {selectedProjects.map((project) => (
        <ProjectCard key={project.repositoryId} project={project} recommendationReason={buildRecommendationReason(project, recommendation.query)} />
      ))}
    </div>
  )
}

function buildRecommendationReason(project: GithubProject, query: string) {
  const preference = getDefaultPreference()
  const preferenceText = `${preference.domains.length > 0 ? preference.domains.join('、') : '全部'}领域、${preference.languages.length > 0 ? preference.languages.join('、') : '全部'}语言、学习目的`
  const demandText = query || '当前项目需求'

  return `${project.fullName} 是${project.description}。（${project.matchReason}。结合用户输入的“${demandText}”以及“${preferenceText}”偏好）${project.sourceGithubUsername}账号关注了该项目。`
}
