import { DataType, MetricType, MilvusClient } from '@zilliz/milvus2-sdk-node'
import { embedProjectProfileQuery, embedProjectProfileTexts, getProjectProfileEmbeddingModel, getProjectProfileEmbeddingVersion, getProjectProfileVectorDimension } from '@/lib/embedding-service'
import { buildProfileHash } from '@/lib/project-profile-hash'
import type { GithubProject, ProjectSearchFilters } from '@/types/insight-radar'

interface ProjectVectorSearchOptions {
  query: string
  filters: ProjectSearchFilters
  limit: number
}

interface ProjectVectorSearchResult {
  repositoryId: string
  score: number
  profileHash: string
}

const collectionName = process.env.MILVUS_PROJECT_PROFILE_COLLECTION || 'insight_radar_project_profiles_bge_m3_1024_v1'
const defaultIvfNlist = 128
const defaultIvfNprobe = 16

export async function upsertProjectProfileVectors(projects: GithubProject[]) {
  const projectsWithProfiles = projects.filter((project) => project.projectSummary?.trim())

  if (projectsWithProfiles.length === 0 || !process.env.MILVUS_ADDRESS) {
    return
  }

  const profileTexts = projectsWithProfiles.map(buildProjectProfileEmbeddingText)
  const profileVectors = await embedProjectProfileTexts(profileTexts)
  const client = await getMilvusClient()

  await ensureProjectProfileCollection(client)
  await client.upsert({
    collection_name: collectionName,
    data: projectsWithProfiles.map((project, index) => ({
      repositoryId: project.repositoryId,
      profileVector: profileVectors[index],
      language: project.language,
      sourceGithubUsername: project.sourceGithubUsername,
      maturity: project.maturity,
      githubUpdatedAt: new Date(project.githubUpdatedAt ?? project.updatedAt).getTime(),
      stars: project.stars,
      profileHash: buildProfileHash({ ...project, projectSummary: project.projectSummary ?? '' }),
      embeddingModel: getProjectProfileEmbeddingModel(),
      embeddingVersion: getProjectProfileEmbeddingVersion(),
      indexedAt: Date.now(),
    })),
  })
  await client.refreshLoad({ collection_name: collectionName })
}

export async function searchProjectProfileVectors({ query, filters, limit }: ProjectVectorSearchOptions): Promise<ProjectVectorSearchResult[]> {
  if (!process.env.MILVUS_ADDRESS || !query.trim()) {
    return []
  }

  try {
    const client = await getMilvusClient()
    await ensureProjectProfileCollection(client)
    const queryVector = await embedProjectProfileQuery(query)
    const result = await client.search({
      collection_name: collectionName,
      data: [queryVector],
      anns_field: 'profileVector',
      limit,
      filter: buildMilvusFilter(filters),
      metric_type: MetricType.COSINE,
      params: { nprobe: Number(process.env.MILVUS_IVF_NPROBE || defaultIvfNprobe) },
      output_fields: ['repositoryId', 'language', 'sourceGithubUsername', 'maturity', 'githubUpdatedAt', 'stars', 'profileHash'],
    })

    return result.results.map((item) => ({
      repositoryId: String(item.repositoryId),
      score: Number(item.score ?? 0),
      profileHash: String(item.profileHash ?? ''),
    }))
  } catch (error) {
    console.error('[project-vector-store] 项目简介向量搜索失败:', error instanceof Error ? error.message : String(error))

    return []
  }
}

export async function clearProjectProfileVectors() {
  if (!process.env.MILVUS_ADDRESS) {
    return
  }

  const client = await getMilvusClient()
  const existingCollection = await client.hasCollection({ collection_name: collectionName })

  if (existingCollection.value) {
    await client.dropCollection({ collection_name: collectionName })
  }
}

export function buildMilvusFilter(filters: ProjectSearchFilters) {
  const conditions: string[] = []

  if (filters.sourceGithubUsername) {
    conditions.push(`sourceGithubUsername == "${escapeMilvusString(filters.sourceGithubUsername)}"`)
  }

  if (filters.languages.length > 0) {
    conditions.push(`language in [${filters.languages.map((language) => `"${escapeMilvusString(language)}"`).join(', ')}]`)
  }

  if (filters.maturity.length > 0) {
    conditions.push(`maturity in [${filters.maturity.map((maturity) => `"${escapeMilvusString(maturity)}"`).join(', ')}]`)
  }

  if (filters.days !== null) {
    const since = Date.now() - filters.days * 24 * 60 * 60 * 1000
    conditions.push(`githubUpdatedAt >= ${since}`)
  }

  return conditions.length > 0 ? conditions.join(' && ') : undefined
}

async function getMilvusClient() {
  const client = new MilvusClient({
    address: process.env.MILVUS_ADDRESS ?? 'localhost:19530',
    token: process.env.MILVUS_TOKEN,
  })
  await client.connectPromise

  return client
}

async function ensureProjectProfileCollection(client: MilvusClient) {
  const existingCollection = await client.hasCollection({ collection_name: collectionName })

  if (!existingCollection.value) {
    await client.createCollection({
      collection_name: collectionName,
      fields: [
        { name: 'repositoryId', data_type: DataType.VarChar, max_length: 64, is_primary_key: true },
        { name: 'profileVector', data_type: DataType.FloatVector, dim: getProjectProfileVectorDimension() },
        { name: 'language', data_type: DataType.VarChar, max_length: 64 },
        { name: 'sourceGithubUsername', data_type: DataType.VarChar, max_length: 128 },
        { name: 'maturity', data_type: DataType.VarChar, max_length: 32 },
        { name: 'githubUpdatedAt', data_type: DataType.Int64 },
        { name: 'stars', data_type: DataType.Int64 },
        { name: 'profileHash', data_type: DataType.VarChar, max_length: 128 },
        { name: 'embeddingModel', data_type: DataType.VarChar, max_length: 64 },
        { name: 'embeddingVersion', data_type: DataType.VarChar, max_length: 64 },
        { name: 'indexedAt', data_type: DataType.Int64 },
      ],
      index_params: [
        {
          field_name: 'profileVector',
          index_type: 'IVF_FLAT',
          metric_type: MetricType.COSINE,
          params: { nlist: Number(process.env.MILVUS_IVF_NLIST || defaultIvfNlist) },
        },
      ],
    })
  } else {
    await assertCompatibleCollection(client)
  }

  await client.loadCollection({ collection_name: collectionName })
}

async function assertCompatibleCollection(client: MilvusClient) {
  const collection = await client.describeCollection({ collection_name: collectionName })
  const fields = collection.schema.fields
  const fieldMap = new Map(fields.map((field) => [field.name, field]))
  const requiredFields = ['repositoryId', 'profileVector', 'profileHash', 'embeddingModel', 'embeddingVersion', 'indexedAt']

  for (const fieldName of requiredFields) {
    if (!fieldMap.has(fieldName)) {
      throw new Error(`Milvus collection ${collectionName} 缺少字段 ${fieldName}，请使用新的 MILVUS_PROJECT_PROFILE_COLLECTION。`)
    }
  }

  const vectorField = fieldMap.get('profileVector')
  const dimension = Number(vectorField?.dim)

  if (dimension !== getProjectProfileVectorDimension()) {
    throw new Error(`Milvus collection ${collectionName} 的 profileVector 维度为 ${dimension}，需要 ${getProjectProfileVectorDimension()}，请使用新的 MILVUS_PROJECT_PROFILE_COLLECTION。`)
  }
}

function buildProjectProfileEmbeddingText(project: GithubProject) {
  return [
    `项目：${project.fullName}`,
    `语言：${project.language}`,
    `描述：${project.description}`,
    `项目简介：${project.projectSummary ?? ''}`,
  ].join('\n')
}

function escapeMilvusString(value: string) {
  return value.replace(/["\\]/g, (matched) => `\\${matched}`)
}
