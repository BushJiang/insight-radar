// Mastra 实例：注册 projectProfileAgent（简介生成）、projectAnalysisAgent（项目分析评分）和 projectRecommendationAgent（智能推荐）
import { Mastra } from '@mastra/core'
import { projectProfileAgent } from './agents/project-profile-agent'
import { projectAnalysisAgent } from './agents/project-analysis-agent'
import { projectRecommendationAgent } from './agents/project-recommendation-agent'

export const mastra = new Mastra({
  agents: { projectProfileAgent, projectAnalysisAgent, projectRecommendationAgent },
})
