import type { RecommendationExplanation } from '@/types/insight-radar'

export type TransientFormState = {
  projects: {
    githubUsername: string
    days: string
    maxProjects: string
  }
  recommendations: {
    query: string
    recommendationLimit: number
    recommendations: RecommendationExplanation[]
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
    recommendationLimit: 4,
    recommendations: [],
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
