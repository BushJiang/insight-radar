import { ProjectCard } from '@/components/projects/project-card'
import { mockPreference, mockProjects } from '@/data/mock-insight-radar'
import { formatIntent } from '@/lib/mock-actions'
import type { GithubProject, RecommendationExplanation } from '@/types/insight-radar'

interface RecommendationExplanationCardProps {
  recommendation: RecommendationExplanation
}

export function RecommendationExplanationCard({ recommendation }: RecommendationExplanationCardProps) {
  const projects = recommendation.projectIds
    .map((projectId) => mockProjects.find((project) => project.repositoryId === projectId))
    .filter((project): project is GithubProject => Boolean(project))

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {projects.map((project) => (
        <ProjectCard key={project.repositoryId} project={project} recommendationReason={buildRecommendationReason(project, recommendation.query)} />
      ))}
    </div>
  )
}

function buildRecommendationReason(project: GithubProject, query: string) {
  const preferenceText = `${mockPreference.domains.join('、')}领域、${mockPreference.languages.join('、')}语言、${formatIntent(mockPreference.intent)}目的`
  const demandText = query || '当前项目需求'

  return `${project.fullName} 是${project.description}。（${project.matchReason}。结合用户输入的“${demandText}”以及“${preferenceText}”偏好）${project.sourceGithubUsername}账号关注了该项目。`
}
