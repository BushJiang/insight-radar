// 推荐解释卡片：ProjectCard + 项目评分 + AI 推荐理由，内部管理翻页
import { useState } from 'react'
import { ProjectCard } from '@/components/projects/project-card'
import { ProjectPagination } from '@/components/projects/project-pagination'
import type { GithubProject, ProjectScore, RecommendationExplanation } from '@/types/insight-radar'

const pageSize = 4
const dimensionLabels: Record<string, string> = {
  '需求匹配度': '需求匹配',
  '项目成熟度': '成熟度',
  '活跃度': '活跃度',
  '内容质量': '内容质量',
  '可信度': '可信度',
}

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
        {paginatedProjects.map((project) => {
          const reason = recommendation.reasons[project.repositoryId]
          const score = recommendation.scores[project.repositoryId]

          return (
            <div key={project.repositoryId} className="flex h-full flex-col gap-4">
              <div className="h-150 overflow-y-auto">
                <ProjectCard project={project} />
              </div>
              {score ? <ScoreCard score={score} /> : null}
              {reason ? <ReasonCard reason={reason} /> : null}
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

function ScoreCard({ score }: { score: ProjectScore }) {
  // 按顺序排列维度
  const dimensionOrder = ['需求匹配度', '项目成熟度', '活跃度', '内容质量', '可信度']

  return (
    <div className="rounded-2xl border border-brand-ring bg-brand-soft px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/40">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-brand-text dark:text-emerald-300">项目评分</p>
        <p className="text-lg font-semibold tabular-nums text-brand-text dark:text-emerald-200">
          {score.totalScore.toFixed(1)}
          <span className="ml-0.5 text-xs font-normal text-slate-500 dark:text-slate-400">/ 5.0</span>
        </p>
      </div>
      <div className="mt-2 space-y-1.5">
        {dimensionOrder.map((dimension) => {
          const value = score.dimensions[dimension] ?? 0
          const percent = Math.round((value / 5) * 100)

          return (
            <div key={dimension} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-xs text-slate-600 dark:text-slate-400">
                {dimensionLabels[dimension] ?? dimension}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-brand-primary transition-all"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="w-7 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">
                {value.toFixed(0)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ReasonCard({ reason }: { reason: string }) {
  return (
    <div className="flex h-70 flex-col overflow-y-auto rounded-2xl border border-brand-ring bg-brand-soft px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/40">
      <p className="text-sm font-medium text-brand-text dark:text-emerald-300">推荐理由：</p>
      <p className="mt-1 text-sm leading-6 text-brand-text whitespace-pre-wrap dark:text-emerald-200">
        {reason}
      </p>
    </div>
  )
}
