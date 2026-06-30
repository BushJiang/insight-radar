// 推荐解释卡片：负责推荐项目列表分页，单个项目展示交给 RecommendationProjectCard
import { useState } from 'react'
import { ProjectPagination } from '@/components/projects/project-pagination'
import { RecommendationProjectCard } from '@/components/recommendations/recommendation-project-card'
import type { GithubProject, RecommendationExplanation } from '@/types/insight-radar'

const pageSize = 4

interface RecommendationExplanationCardProps {
  recommendation: RecommendationExplanation
  projects: GithubProject[]
}

export function RecommendationExplanationCard({ recommendation, projects }: RecommendationExplanationCardProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const projectMap = new Map(projects.map((project) => [project.repositoryId, project] as const))
  const selectedProjects = recommendation.projectIds
    .map((projectId) => projectMap.get(projectId))
    .filter((project): project is GithubProject => Boolean(project))
  const totalPages = Math.max(1, Math.ceil(selectedProjects.length / pageSize))
  const paginatedProjects = selectedProjects.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className="space-y-4">
      <div className="grid gap-8 lg:grid-cols-2">
        {paginatedProjects.map((project) => (
          <RecommendationProjectCard
            key={project.repositoryId}
            project={project}
            score={recommendation.scores[project.repositoryId]}
            reason={recommendation.reasons[project.repositoryId]}
          />
        ))}
      </div>
      {selectedProjects.length > pageSize ? (
        <ProjectPagination currentPage={currentPage} totalPages={totalPages} totalItems={selectedProjects.length} onPageChange={setCurrentPage} />
      ) : null}
    </div>
  )
}
