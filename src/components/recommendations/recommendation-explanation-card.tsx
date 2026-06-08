import { useState } from 'react'
import { ProjectCard } from '@/components/projects/project-card'
import { ProjectPagination } from '@/components/projects/project-pagination'
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
      <div className="grid gap-4 xl:grid-cols-2">
        {paginatedProjects.map((project) => {
          const reason = recommendation.reasons[project.repositoryId]

          return (
            <div key={project.repositoryId} className="flex h-full flex-col gap-2">
              <div className="h-150 overflow-y-auto">
                <ProjectCard project={project} />
              </div>
              {reason ? (
                <div className="flex h-70 flex-col overflow-y-auto rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/40">
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">推荐理由：</p>
                  <p className="mt-1 text-sm leading-6 text-emerald-800 dark:text-emerald-200">
                    {reason}
                  </p>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
      {selectedProjects.length > pageSize ? (
        <ProjectPagination currentPage={currentPage} totalPages={totalPages} totalItems={selectedProjects.length} onPageChange={setCurrentPage} />
      ) : null}
    </div>
  )
}
