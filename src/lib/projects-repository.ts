import { and, asc, count, eq, ilike, isNull, or, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { projects } from '@/lib/db/schema'
import type { GithubProject } from '@/types/insight-radar'

export interface HomeMetrics {
  projectCount: number
  sourceUsernames: string[]
}

export interface PersistProjectsResult {
  createdProjects: GithubProject[]
  duplicateCount: number
  updatedDuplicateCount: number
  unchangedDuplicateCount: number
}

type ProjectUpdateValues = Partial<typeof projects.$inferInsert>

const collectedFieldNames = [
  'name',
  'fullName',
  'description',
  'sourceUrl',
  'language',
  'topics',
  'stars',
  'forks',
  'issues',
  'license',
  'isFork',
  'sourceRepositoryFullName',
  'sourceRepositoryUrl',
  'sourceGithubUsername',
  'starAt',
  'pushedAt',
  'githubUpdatedAt',
  'readmeContent',
  'maturity',
  'matchReason',
  'collectionJobId',
] as const

export async function persistCollectedProjects(collectedProjects: GithubProject[]): Promise<PersistProjectsResult> {
  const db = getDb()
  const createdProjects: GithubProject[] = []
  let duplicateCount = 0
  let updatedDuplicateCount = 0
  let unchangedDuplicateCount = 0

  for (const project of collectedProjects) {
    const existingProject = await findProjectByRepositoryId(project.repositoryId)
    const nextRecord = toProjectRecord(project)

    if (!existingProject) {
      const [createdProject] = await db.insert(projects).values(nextRecord).returning()
      createdProjects.push(toGithubProject(createdProject))
      continue
    }

    duplicateCount += 1
    const changedValues = getChangedProjectValues(existingProject, nextRecord)

    if (Object.keys(changedValues).length === 0) {
      unchangedDuplicateCount += 1
      continue
    }

    await db.update(projects).set({ ...changedValues, updatedAt: new Date() }).where(eq(projects.id, existingProject.id))
    updatedDuplicateCount += 1
  }

  return { createdProjects, duplicateCount, updatedDuplicateCount, unchangedDuplicateCount }
}

export async function getHomeMetrics(): Promise<HomeMetrics> {
  const db = getDb()
  const [projectCountRow, sourceRows] = await Promise.all([
    db.select({ value: count() }).from(projects).where(isNull(projects.deletedAt)),
    db.select({ sourceGithubUsername: projects.sourceGithubUsername }).from(projects).where(isNull(projects.deletedAt)).orderBy(asc(projects.sourceGithubUsername)),
  ])

  return {
    projectCount: projectCountRow[0]?.value ?? 0,
    sourceUsernames: Array.from(new Set(sourceRows.map((row) => row.sourceGithubUsername))),
  }
}

export async function getLatestProjects(limit: number) {
  const db = getDb()
  const rows = await db.select().from(projects).where(isNull(projects.deletedAt)).orderBy(sql`${projects.starAt} desc`).limit(Math.max(1, limit))

  return rows.map(toGithubProject)
}

export async function getProjectMapByRepositoryIds(repositoryIds: string[]) {
  if (repositoryIds.length === 0) {
    return new Map<string, GithubProject>()
  }

  const db = getDb()
  const rows = await db.select().from(projects).where(and(isNull(projects.deletedAt), sql`${projects.repositoryId} = any(${repositoryIds})`))

  return new Map(rows.map((project) => {
    const mappedProject = toGithubProject(project)

    return [mappedProject.repositoryId, mappedProject] as const
  }))
}

export async function searchProjectsFromDatabase(filters: { query: string; languages: string[]; sourceGithubUsername: string | null; page: number; pageSize: number }) {
  const db = getDb()
  const query = filters.query.trim()
  const conditions = [isNull(projects.deletedAt)]

  if (query) {
    const keyword = `%${escapeLikePattern(query)}%`
    conditions.push(or(
      ilike(projects.name, keyword),
      ilike(projects.fullName, keyword),
      ilike(projects.description, keyword),
      ilike(projects.readmeSummary, keyword),
      ilike(projects.readmeContent, keyword),
    )!)
  }

  if (filters.languages.length > 0) {
    conditions.push(or(...filters.languages.map((language) => eq(projects.language, language)))!)
  }

  if (filters.sourceGithubUsername) {
    conditions.push(eq(projects.sourceGithubUsername, filters.sourceGithubUsername))
  }

  const page = Math.max(1, filters.page)
  const pageSize = Math.max(1, filters.pageSize)
  const offset = (page - 1) * pageSize
  const where = and(...conditions)
  const [rows, totalRows] = await Promise.all([
    db.select().from(projects).where(where).limit(pageSize).offset(offset),
    db.select({ value: count() }).from(projects).where(where),
  ])

  return {
    projects: rows.map(toGithubProject),
    totalCount: totalRows[0]?.value ?? 0,
  }
}

export async function listCollectedSourceGithubUsernames() {
  const db = getDb()
  const rows = await db.select({ sourceGithubUsername: projects.sourceGithubUsername }).from(projects).where(isNull(projects.deletedAt)).orderBy(asc(projects.sourceGithubUsername))

  return Array.from(new Set(rows.map((row) => row.sourceGithubUsername)))
}

export async function getProjectByRepositoryId(repositoryId: string) {
  const db = getDb()
  const [project] = await db.select().from(projects).where(and(eq(projects.repositoryId, repositoryId), isNull(projects.deletedAt))).limit(1)

  return project ? toGithubProject(project) : null
}

async function findProjectByRepositoryId(repositoryId: string) {
  const db = getDb()
  const [project] = await db.select().from(projects).where(eq(projects.repositoryId, repositoryId)).limit(1)

  return project ?? null
}

function toProjectRecord(project: GithubProject): typeof projects.$inferInsert {
  return {
    id: project.id ?? `project-${project.repositoryId}`,
    repositoryId: project.repositoryId,
    name: project.name,
    fullName: project.fullName,
    description: project.description,
    sourceUrl: project.sourceUrl,
    language: project.language,
    topics: project.topics,
    stars: project.stars,
    forks: project.forks,
    issues: project.issues,
    license: project.license,
    isFork: project.isFork,
    sourceRepositoryFullName: project.sourceRepositoryFullName,
    sourceRepositoryUrl: project.sourceRepositoryUrl,
    sourceGithubUsername: project.sourceGithubUsername,
    starAt: new Date(project.starAt),
    pushedAt: project.pushedAt ? new Date(project.pushedAt) : null,
    githubUpdatedAt: new Date(project.githubUpdatedAt ?? project.updatedAt),
    readmeContent: project.readmeContent,
    readmeSummary: project.readmeSummary,
    matchReason: project.matchReason,
    maturity: project.maturity,
    collectionJobId: project.collectionJobId,
    notes: project.notes ?? null,
    deletedAt: project.deletedAt ? new Date(project.deletedAt) : null,
  }
}

function getChangedProjectValues(currentProject: typeof projects.$inferSelect, nextProject: typeof projects.$inferInsert) {
  const changes: ProjectUpdateValues = {}

  for (const fieldName of collectedFieldNames) {
    const currentValue = currentProject[fieldName]
    const nextValue = nextProject[fieldName]

    if (!isSameValue(currentValue, nextValue)) {
      changes[fieldName] = nextValue as never
    }
  }

  return changes
}

function isSameValue(currentValue: unknown, nextValue: unknown) {
  if (currentValue instanceof Date && nextValue instanceof Date) {
    return currentValue.getTime() === nextValue.getTime()
  }

  if (currentValue instanceof Date || nextValue instanceof Date) {
    return new Date(String(currentValue)).getTime() === new Date(String(nextValue)).getTime()
  }

  if (Array.isArray(currentValue) || Array.isArray(nextValue)) {
    return JSON.stringify(currentValue ?? []) === JSON.stringify(nextValue ?? [])
  }

  return currentValue === nextValue
}

export function toGithubProject(project: typeof projects.$inferSelect): GithubProject {
  return {
    id: project.id,
    repositoryId: project.repositoryId,
    fullName: project.fullName,
    name: project.name,
    description: project.description,
    language: project.language,
    stars: project.stars,
    forks: project.forks,
    issues: project.issues,
    updatedAt: project.githubUpdatedAt.toISOString(),
    deletedAt: project.deletedAt?.toISOString() ?? null,
    notes: project.notes,
    pushedAt: project.pushedAt?.toISOString() ?? null,
    readmeSummary: project.readmeSummary,
    readmeContent: project.readmeContent,
    topics: project.topics,
    license: project.license,
    isFork: project.isFork,
    sourceRepositoryFullName: project.sourceRepositoryFullName,
    sourceRepositoryUrl: project.sourceRepositoryUrl,
    sourceGithubUsername: project.sourceGithubUsername,
    githubUpdatedAt: project.githubUpdatedAt.toISOString(),
    starAt: project.starAt.toISOString(),
    sourceUrl: project.sourceUrl,
    matchReason: project.matchReason,
    maturity: project.maturity,
    collectionJobId: project.collectionJobId,
  }
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (matched) => `\\${matched}`)
}
