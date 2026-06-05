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

export interface GithubProject {
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
  readmeSummary: string | null
  readmeContent: string | null
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
  sourceGithubUsername: string | null
  days: number | null
}

export interface UserPreference {
  id: string
  domains: string[]
  languages: string[]
  maturity: ProjectMaturity[]
  intent: RecommendationIntent
  rankingMode: 'new' | 'mature' | 'growth' | 'multi_source' | 'no_preference'
  updatedAt: string
}

export interface RecommendationExplanation {
  id: string
  projectIds: string[]
  query: string
  facts: string[]
  inferences: string[]
  suggestions: string[]
  sources: string[]
  confidence: RecommendationConfidence
  createdAt: string
}

export interface GithubStarredSearchRequest {
  filters: ProjectSearchFilters
  githubToken?: string
  maxProjects?: number
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

export interface UserSettings {
  githubToken: string
}
