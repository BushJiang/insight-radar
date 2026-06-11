import { Mastra } from '@mastra/core'
import { projectProfileAgent } from './agents/project-profile-agent'
import { projectRecommendationAgent } from './agents/project-recommendation-agent'

export const mastra = new Mastra({
  agents: { projectProfileAgent, projectRecommendationAgent },
})
