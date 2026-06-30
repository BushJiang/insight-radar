// TypeScript 类型定义：项目、搜索、推荐、采集、用户偏好等全部接口和类型，全项目共用
export type CollectionJobStatus = 'pending' | 'running' | 'success' | 'partial_success' | 'failed'

export type ProjectMaturity = 'early' | 'growth' | 'mature' | 'stalled'

export type RecommendationConfidence = 'high' | 'medium' | 'low'

export type RecommendationIntent = 'learning' | 'production' | 'contribution' | 'selection' | 'risk'

export interface CollectionJob {
  id: string
  githubUsername: string
  status: CollectionJobStatus
  startedAt: string | null
  finishedAt: string | null
  createdProjectCount: number
  duplicateProjectCount: number
  updatedProjectCount: number
  failedCount: number
  errorMessage: string | null
  rateLimitResetAt: string | null
}

export interface GithubProject extends Record<string, unknown> {
  id?: string
  repositoryId: string
  fullName: string
  name: string
  description: string
  language: string
  stars: number
  forks: number
  issues: number
  updatedAt: string
  deletedAt?: string | null
  notes?: string | null
  pushedAt: string | null
  projectSummary: string | null
  readmeContent: string | null
  readmeHash: string | null
  topics: string[]
  license: string | null
  isFork: boolean
  sourceRepositoryFullName: string | null
  sourceRepositoryUrl: string | null
  sourceGithubUsername: string
  githubUpdatedAt?: string
  starAt: string
  sourceUrl: string
  matchReason: string
  maturity: ProjectMaturity
  collectionJobId: string
}

export interface ProjectSearchFilters {
  query: string
  languages: string[]
  maturity: ProjectMaturity[]
  sourceGithubUsername: string | null
  days: number | null
}

export interface SearchProjectsResponse {
  projects: GithubProject[]
  totalCount: number
  sources: string[]
  error: string | null
}

export interface UserPreference {
  id: string
  domains: string[]
  recommendationAgentPrompt: string
  projectProfileAgentPrompt: string
  candidateMultiplier: number
  profileConcurrency: number
  analysisConcurrency: number
  reasonConcurrency: number
  updatedAt: string
}

export interface ProjectScore {
  totalScore: number
  dimensions: Record<string, number>
  analysisReason: string
}

export interface ProjectRecommendationReason {
  repositoryId: string
  fitReasons: [string, string, string]
  riskReminder: string
}

export interface RecommendationExplanation {
  id: string
  projectIds: string[]
  query: string
  reasons: Record<string, ProjectRecommendationReason>
  scores: Record<string, ProjectScore>
  facts: string[]
  inferences: string[]
  suggestions: string[]
  sources: string[]
  confidence: RecommendationConfidence
  createdAt: string
}

export interface RecommendationPageState {
  query: string
  filters: ProjectSearchFilters
  recommendationLimit: number
  recommendations: RecommendationExplanation[]
}

export interface VectorIndexStatus {
  totalCount: number
  unprofiledCount: number
  indexedCount: number
  unindexedCount: number
  lastSyncAt: string | null
}

export interface ProjectProfileProgress {
  status: 'ready' | 'running' | 'failed'
  completedCount: number
  totalCount: number
  message: string | null
}

export interface ProjectsPageSnapshot {
  items: GithubProject[]
  sourceGithubUsername: string | null
  updatedAt: string | null
}

export interface GithubStarredSearchResponse {
  projects: GithubProject[]
  totalCount: number
  fetchedCount: number
  duplicateCount: number
  updatedDuplicateCount: number
  unchangedDuplicateCount: number
  estimatedTotalCount: number | null
  rateLimitRemaining: string | null
  rateLimitResetAt: string | null
  error: string | null
}

export interface CollectionProgress {
  status: CollectionJobStatus
  currentUsername: string | null
  fetchedCount: number
  duplicateCount: number
  updatedDuplicateCount: number
  unchangedDuplicateCount: number
  estimatedTotalCount: number | null
  startedAt: string | null
  finishedAt: string | null
  errorMessage: string | null
}

export interface UserApiKeys {
  githubToken: string
  deepseekApiKey: string
  siliconFlowApiKey: string
}

export type UserSettings = UserApiKeys

export interface HomeMetrics {
  projectCount: number
  sourceCount: number
}
