// 🔰 表单状态缓存：内存中暂存项目库和推荐表单的填写内容，页面刷新后恢复（不持久化到磁盘）
import type { GithubProject, ProjectSearchFilters, RecommendationExplanation } from '@/types/insight-radar'

export type TransientFormState = {
  projects: {
    githubUsername: string
    days: string
    maxProjects: string
  }
  recommendations: {
    query: string
    filters: ProjectSearchFilters
    recommendationLimit: number
    recommendations: RecommendationExplanation[]
    projects: GithubProject[]
  }
}

const defaultTransientFormState: TransientFormState = {
  projects: {
    githubUsername: '',
    days: '7',
    maxProjects: '30',
  },
  recommendations: {
    query: '',
    filters: {
      query: '',
      languages: [],
      maturity: [],
      sourceGithubUsername: null,
      days: null,
    },
    recommendationLimit: 4,
    recommendations: [],
    projects: [],
  },
}

let transientFormState: TransientFormState = defaultTransientFormState

export function readTransientFormState() {
  return transientFormState
}

export function writeTransientProjectFormState(nextState: Partial<TransientFormState['projects']>) {
  transientFormState = {
    ...transientFormState,
    projects: {
      ...transientFormState.projects,
      ...nextState,
    },
  }
}

export function writeTransientRecommendationFormState(nextState: Partial<TransientFormState['recommendations']>) {
  transientFormState = {
    ...transientFormState,
    recommendations: {
      ...transientFormState.recommendations,
      ...nextState,
    },
  }
}

export function writeTransientFormState(nextState: Partial<TransientFormState>) {
  transientFormState = {
    ...transientFormState,
    ...nextState,
    projects: {
      ...transientFormState.projects,
      ...nextState.projects,
    },
    recommendations: {
      ...transientFormState.recommendations,
      ...nextState.recommendations,
    },
  }
}
