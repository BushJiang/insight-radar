import { z } from 'zod'

export const projectMaturityEnum = z.enum(['early', 'growth', 'mature', 'stalled'])

export const projectSearchFiltersSchema = z.object({
  query: z.string().default(''),
  languages: z.array(z.string()).default([]),
  maturity: z.array(projectMaturityEnum).default([]),
  sourceGithubUsername: z.string().nullable().default(null),
  days: z.number().nullable().default(null),
})

export const searchProjectsSchema = z.object({
  filters: projectSearchFiltersSchema,
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
})

export const githubStarredSearchSchema = z.object({
  filters: projectSearchFiltersSchema,
  githubToken: z.string().optional(),
  maxProjects: z.number().int().min(0).optional(),
})

export const userPreferenceSchema = z.object({
  id: z.string(),
  domains: z.array(z.string()).default([]),
  recommendationAgentPrompt: z.string().default(''),
  projectProfileAgentPrompt: z.string().default(''),
  candidateProjectCount: z.number().int().min(1).max(50).default(4),
  updatedAt: z.string(),
})

export const recommendationRequestSchema = z.object({
  query: z.string(),
  filters: projectSearchFiltersSchema,
  recommendationLimit: z.number().int().min(1).max(50).default(4),
  preference: userPreferenceSchema.partial().optional(),
})

export type SearchProjectsRequest = z.infer<typeof searchProjectsSchema>
export type GithubStarredSearchRequest = z.infer<typeof githubStarredSearchSchema>
