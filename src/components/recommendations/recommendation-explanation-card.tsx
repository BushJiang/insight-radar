import { ProjectCard } from '@/components/projects/project-card'
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
  const demandText = query || '当前项目需求'

  return `${project.fullName} 适合“${demandText}”。${project.readmeSummary ?? project.description} 来源账号：${project.sourceGithubUsername}。`
}
