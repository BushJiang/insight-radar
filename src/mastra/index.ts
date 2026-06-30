// Mastra 实例：注册 projectProfileAgent（简介生成）、projectAnalysisAgent（项目分析评分）、projectRecommendationAgent（智能推荐）和业务工作流
import { Mastra } from '@mastra/core'
import { projectProfileAgent } from './agents/project-profile-agent'
import { projectAnalysisAgent } from './agents/project-analysis-agent'
import { projectRecommendationAgent } from './agents/project-recommendation-agent'
import { githubStarCollectionWorkflow } from './workflows/github-star-collection-workflow'
import { projectRecommendationWorkflow } from './workflows/project-recommendation-workflow'

export const mastra = new Mastra({
  agents: { projectProfileAgent, projectAnalysisAgent, projectRecommendationAgent },
  workflows: { githubStarCollectionWorkflow, projectRecommendationWorkflow },
})
