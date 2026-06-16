// 🔰 推荐解释卡片：内嵌 ProjectCard + AI 推荐理由（事实/推断/建议），内部管理翻页。推荐页使用
import { useState } from 'react'
import { ProjectCard } from '@/components/projects/project-card'
import { ProjectPagination } from '@/components/projects/project-pagination'
import type { GithubProject, RecommendationExplanation } from '@/types/insight-radar'

const pageSize = 4

interface RecommendationExplanationCardProps {
  recommendation: RecommendationExplanation
  projects: GithubProject[]
}

// 🔰 推荐结果卡片，内嵌 ProjectCard 并附带 AI 生成的推荐理由，内部管理翻页状态
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
      <div className="grid gap-8 xl:grid-cols-2">
        {paginatedProjects.map((project) => {
          const reason = recommendation.reasons[project.repositoryId]

          return (
            <div key={project.repositoryId} className="flex h-full flex-col gap-8">
              <div className="h-150 overflow-y-auto">
                <ProjectCard project={project} />
              </div>
              {reason ? (
                <div className="flex h-70 flex-col overflow-y-auto rounded-2xl border border-brand-ring bg-brand-soft px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/40">
                  <p className="text-sm font-medium text-brand-text dark:text-emerald-300">推荐理由：</p>
                  <p className="mt-1 text-sm leading-6 text-brand-text whitespace-pre-wrap dark:text-emerald-200">
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
