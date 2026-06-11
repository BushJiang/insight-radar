import { DataType, MetricType, MilvusClient } from '@zilliz/milvus2-sdk-node'
import { buildProfileHash } from '@/lib/project-profile-service'
import type { GithubProject, ProjectSearchFilters } from '@/types/insight-radar'

interface ProjectVectorSearchOptions {
  query: string
  filters: ProjectSearchFilters
  limit: number
}

const collectionName = process.env.MILVUS_PROJECT_COLLECTION || 'insight_radar_project_profiles'
const vectorDimension = Number(process.env.PROJECT_PROFILE_VECTOR_DIMENSION || 64)

// 🔰 将项目简介向量化后写入 Milvus，用于语义搜索
export async function upsertProjectProfileVectors(projects: GithubProject[]) {
  const projectsWithProfiles = projects.filter((project) => project.readmeSummary)

  if (projectsWithProfiles.length === 0 || !process.env.MILVUS_ADDRESS) {
    return
  }

  try {
    const client = await getMilvusClient()
    await ensureProjectProfileCollection(client)
    await client.upsert({
      collection_name: collectionName,
      data: projectsWithProfiles.map((project) => ({
        repositoryId: project.repositoryId,
        profileVector: createDeterministicVector(project.readmeSummary ?? ''),
        language: project.language,
        sourceGithubUsername: project.sourceGithubUsername,
        maturity: project.maturity,
        githubUpdatedAt: new Date(project.githubUpdatedAt ?? project.updatedAt).getTime(),
        stars: project.stars,
        profileHash: buildProfileHash(project),
        embeddingVersion: 'deterministic-local-v1',
        indexedAt: Date.now(),
      })),
    })
    await client.refreshLoad({ collection_name: collectionName })
  } catch {
    return
  }
}

// 🔰 在 Milvus 中搜索语义相似的项目简介，结合结构化过滤和 COSINE 相似度排序
export async function searchProjectProfileVectors({ query, filters, limit }: ProjectVectorSearchOptions) {
  if (!process.env.MILVUS_ADDRESS) {
    return []
  }

  try {
    const client = await getMilvusClient()
    await ensureProjectProfileCollection(client)
    const result = await client.search({
      collection_name: collectionName,
      data: [createDeterministicVector(query)],
      limit,
      filter: buildMilvusFilter(filters),
      metric_type: MetricType.COSINE,
      output_fields: ['repositoryId', 'language', 'sourceGithubUsername', 'maturity', 'githubUpdatedAt', 'stars', 'profileHash'],
    })

    return result.results.map((item) => ({
      repositoryId: String(item.repositoryId),
      score: Number(item.score ?? 0),
      profileHash: String(item.profileHash ?? ''),
    }))
  } catch {
    return []
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
        { name: 'profileVector', data_type: DataType.FloatVector, dim: vectorDimension },
        { name: 'language', data_type: DataType.VarChar, max_length: 64 },
        { name: 'sourceGithubUsername', data_type: DataType.VarChar, max_length: 128 },
        { name: 'maturity', data_type: DataType.VarChar, max_length: 32 },
        { name: 'githubUpdatedAt', data_type: DataType.Int64 },
        { name: 'stars', data_type: DataType.Int64 },
        { name: 'profileHash', data_type: DataType.VarChar, max_length: 128 },
        { name: 'embeddingVersion', data_type: DataType.VarChar, max_length: 64 },
        { name: 'indexedAt', data_type: DataType.Int64 },
      ],
      index_params: [
        {
          field_name: 'profileVector',
          index_type: 'HNSW',
          metric_type: MetricType.COSINE,
          params: { M: 16, efConstruction: 256 },
        },
      ],
    })
  }

  await client.loadCollection({ collection_name: collectionName })
}

function createDeterministicVector(text: string) {
  const vector = Array.from({ length: vectorDimension }, () => 0)
  const normalizedText = text.trim().toLowerCase()

  for (let index = 0; index < normalizedText.length; index += 1) {
    const code = normalizedText.charCodeAt(index)
    vector[index % vectorDimension] += code / 65535
  }

  const length = Math.hypot(...vector) || 1

  return vector.map((value) => value / length)
}

function escapeMilvusString(value: string) {
  return value.replace(/["\\]/g, (matched) => `\\${matched}`)
}
