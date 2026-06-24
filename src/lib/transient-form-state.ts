// 表单状态缓存：内存中暂存项目库、搜索和推荐表单内容，客户端切页可恢复，完整刷新后重置
import type { GithubProject, ProjectSearchFilters, RecommendationExplanation, VectorIndexStatus } from '@/types/insight-radar'

export type TransientFormState = {
  projects: {
    githubUsername: string
    days: string
    maxProjects: string
  }
  search: {
    draftFilters: ProjectSearchFilters
    sources: string[]
    sourcesLoaded: boolean
  }
  recommendations: {
    query: string
    filters: ProjectSearchFilters
    recommendationLimit: number
    recommendations: RecommendationExplanation[]
    projects: GithubProject[]
    sources: string[]
    sourcesLoaded: boolean
    vectorStatus: VectorIndexStatus
    vectorStatusLoaded: boolean
    vectorStatusFilters: ProjectSearchFilters | null
  }
}
// 定义默认表单状态。整个前端运行期间共用这一份表单状态缓存的默认值
const defaultTransientFormState: TransientFormState = {
  // 项目库页面表单
  projects: {
    githubUsername: '',
    days: '7',
    maxProjects: '30',
  },
  // 搜索页面表单草稿和来源账号选项，只在客户端切页期间保留
  search: {
    draftFilters: {
      query: '',
      languages: [],
      maturity: [],
      sourceGithubUsername: null,
      days: null,
    },
    sources: [],
    sourcesLoaded: false,
  },
  // 推荐页面表单
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
    sources: [],
    sourcesLoaded: false,
    vectorStatus: { indexedCount: 0, unindexedCount: 0, lastSyncAt: null },
    vectorStatusLoaded: false,
    vectorStatusFilters: null,
  },
}
// 用上面定义的默认值初始化 transientFormState ，作为“临时表单状态”
// 作用是在应用运行期间，暂时记住用户在表单中填写的内容；客户端路由切换不会丢，完整刷新会回到默认值
let transientFormState: TransientFormState = defaultTransientFormState

// 用来读取临时（transient）表单状态
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

export function writeTransientSearchFormState(nextState: Partial<TransientFormState['search']>) {
  transientFormState = {
    ...transientFormState,
    search: {
      ...transientFormState.search,
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
    search: {
      ...transientFormState.search,
      ...nextState.search,
    },
    recommendations: {
      ...transientFormState.recommendations,
      ...nextState.recommendations,
    },
  }
}
