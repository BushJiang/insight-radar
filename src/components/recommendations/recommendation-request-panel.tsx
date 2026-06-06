'use client'

import { getDefaultPreference } from '@/lib/default-preference'
import type { GithubProject, RecommendationExplanation } from '@/types/insight-radar'

interface RecommendationRequestPanelProps {
  projects: GithubProject[]
  query: string
  onQueryChange: (value: string) => void
  recommendationLimit: number
  onRecommendationLimitChange: (limit: number) => void
  onGenerated: (recommendation: RecommendationExplanation) => void
}

export function RecommendationRequestPanel({ projects, query, onQueryChange, recommendationLimit, onRecommendationLimitChange, onGenerated }: RecommendationRequestPanelProps) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const selectedProjects = projects.slice(0, recommendationLimit)
    const preference = getDefaultPreference()
    const demandText = query || `基于 ${selectedProjects.length.toLocaleString('zh-CN')} 个候选项目生成推荐`

    onGenerated({
      id: `rec-${Date.now()}`,
      projectIds: selectedProjects.map((project) => project.repositoryId),
      query: demandText,
      facts: selectedProjects.map((project) => `${project.fullName} 的主要语言是 ${project.language}，来源账号是 ${project.sourceGithubUsername}。`),
      inferences: selectedProjects.map((project) => `${project.fullName} 的匹配理由是：${project.matchReason}`),
      suggestions: [
        `当前推荐目的为“学习”，建议先查看 README、最近提交和 Issue 活跃度。`,
        '如果用于生产引入，需要继续检查许可证、发布节奏和社区维护状态。',
      ],
      sources: selectedProjects.map((project) => project.sourceUrl),
      confidence: selectedProjects.every((project) => project.sourceUrl) ? 'high' : 'low',
      createdAt: preference.updatedAt,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <label htmlFor="recommendation-query" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
        项目需求
      </label>
      <textarea
        id="recommendation-query"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="描述你想找的项目"
        className="mt-2 min-h-28 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-950"
      />
      <div className="mt-3 max-w-48">
        <label htmlFor="recommendation-limit" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          推荐数量
        </label>
        <input
          id="recommendation-limit"
          type="number"
          min={1}
          max={50}
          value={recommendationLimit}
          onChange={(event) => onRecommendationLimitChange(Math.max(1, Number(event.target.value) || 1))}
          className="mt-2 h-[46px] w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-black outline-none dark:border-slate-700 dark:bg-white dark:text-black"
        />
      </div>
      <button type="submit" className="mt-3 h-[46px] cursor-pointer rounded-xl bg-brand-primary px-5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-primary-hover active:scale-95">
        智能推荐
      </button>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        智能推荐会结合项目库中的候选项目、来源证据和你的项目需求生成解释。
      </p>
    </form>
  )
}
