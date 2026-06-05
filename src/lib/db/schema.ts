import { sql } from 'drizzle-orm'
import { index, boolean, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import type { ProjectMaturity } from '@/types/insight-radar'

export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  repositoryId: text('repository_id').notNull(),
  name: text('name').notNull(),
  fullName: text('full_name').notNull(),
  description: text('description').notNull(),
  sourceUrl: text('source_url').notNull(),
  language: text('language').notNull(),
  topics: jsonb('topics').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  stars: integer('stars').notNull().default(0),
  forks: integer('forks').notNull().default(0),
  issues: integer('issues').notNull().default(0),
  license: text('license'),
  isFork: boolean('is_fork').notNull().default(false),
  sourceRepositoryFullName: text('source_repository_full_name'),
  sourceRepositoryUrl: text('source_repository_url'),
  sourceGithubUsername: text('source_github_username').notNull(),
  starAt: timestamp('star_at', { withTimezone: true }).notNull(),
  pushedAt: timestamp('pushed_at', { withTimezone: true }),
  githubUpdatedAt: timestamp('github_updated_at', { withTimezone: true }).notNull(),
  readmeContent: text('readme_content'),
  readmeSummary: text('readme_summary'),
  matchReason: text('match_reason').notNull(),
  maturity: text('maturity').$type<ProjectMaturity>().notNull(),
  collectionJobId: text('collection_job_id').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('projects_repository_id_unique').on(table.repositoryId),
  uniqueIndex('projects_full_name_unique').on(table.fullName),
  index('projects_name_index').on(table.name),
  index('projects_source_github_username_index').on(table.sourceGithubUsername),
])

export type ProjectRecord = typeof projects.$inferSelect
export type NewProjectRecord = typeof projects.$inferInsert
