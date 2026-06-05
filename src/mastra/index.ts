import { Mastra } from '@mastra/core'
import { projectRecommendationAgent } from './agents/project-recommendation-agent'
import { projectLibraryTool } from './tools/project-library-tool'

export const mastra = new Mastra({
  agents: { projectRecommendationAgent },
  tools: { projectLibraryTool },
})
