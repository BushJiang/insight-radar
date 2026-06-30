import { DataType, MetricType, MilvusClient } from '@zilliz/milvus2-sdk-node'
import { embedProjectProfileQuery, embedProjectProfileTexts, getProjectProfileEmbeddingModel, getProjectProfileEmbeddingVersion, getProjectProfileVectorDimension } from '@/lib/embedding-service'
import { buildProfileHash } from '@/lib/project-profile-hash'
import type { GithubProject, ProjectSearchFilters } from '@/types/insight-radar'

const logPrefix = '[project-vector-store] '

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

const collectionName = process.env.MILVUS_PROJECT_PROFILE_COLLECTION || 'InsightRadar'
const defaultIvfNlist = 128
const defaultIvfNprobe = 16

// 将项目列表的简介文本转为向量并存入 Milvus 集合，支持增量更新
export async function upsertProjectProfileVectors(projects: GithubProject[]) {
  const projectsWithProfiles = projects.filter((project) => project.projectSummary?.trim())

  if (projectsWithProfiles.length === 0 || !process.env.MILVUS_ADDRESS) {
    return
  }

  console.log(`${logPrefix}🧬 正在为 ${projectsWithProfiles.length} 个项目生成向量 (模型: ${getProjectProfileEmbeddingModel()})...`)
  const profileTexts = projectsWithProfiles.map(buildProjectProfileEmbeddingText)
  const profileVectors = await embedProjectProfileTexts(profileTexts)
  console.log(`${logPrefix}🧬 向量生成完成 (${profileVectors.length} 条, 维度: ${getProjectProfileVectorDimension()})`)

  console.log(`${logPrefix}📥 正在写入 Milvus 集合 ${collectionName}...`)
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
  console.log(`${logPrefix}📥 Milvus 写入完成 (${projectsWithProfiles.length} 条)`)
  await client.refreshLoad({ collection_name: collectionName })
}

// 将用户查询文本转为向量，在项目简介向量集合中做相似度搜索，返回最匹配的项目列表
export async function searchProjectProfileVectors({ query, filters, limit }: ProjectVectorSearchOptions): Promise<ProjectVectorSearchResult[]> {
  // 没有 Milvus 配置或用户需求为空时直接返回空结果，让推荐服务回退到 PostgreSQL 候选项目
  if (!process.env.MILVUS_ADDRESS || !query.trim()) {
    return []
  }

  try {
    const client = await getMilvusClient()
    await ensureProjectProfileCollection(client)
    console.log(`${logPrefix}开始生成查询向量: queryLength=${query.trim().length}, limit=${limit}`)
    // 把用户需求文本转成向量，后续用它在项目简介向量集合里做相似度搜索
    const queryVector = await embedProjectProfileQuery(query)
    console.log(`${logPrefix}查询向量生成成功: dimension=${queryVector.length}`)
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

    console.log(`${logPrefix}Milvus search 返回: resultCount=${result.results.length}`)

    return result.results.map((item) => ({
      repositoryId: String(item.repositoryId),
      score: Number(item.score ?? 0),
      profileHash: String(item.profileHash ?? ''),
    }))
  } catch (error) {
    console.error(`${logPrefix}项目简介向量搜索失败:`, error instanceof Error ? error.message : String(error))

    return []
  }
}

// 获取 Milvus 中所有已入库的 repositoryId 列表
export async function getAllVectorRepositoryIds(): Promise<string[]> {
  if (!process.env.MILVUS_ADDRESS) return []

  try {
    const client = await getMilvusClient()
    await ensureProjectProfileCollection(client)
    const result = await client.query({
      collection_name: collectionName,
      filter: 'repositoryId != ""',
      output_fields: ['repositoryId'],
      limit: 10000,
    })

    return result.data.map((item) => String(item.repositoryId))
  } catch (error) {
    console.error(`${logPrefix}查询向量库 repositoryId 列表失败:`, error instanceof Error ? error.message : String(error))
    return []
  }
}

// 获取 Milvus 中所有已入库的记录：repositoryId → profileHash，用于检测简介变更导致的过期向量
export async function getAllVectorRecords(): Promise<Map<string, string>> {
  if (!process.env.MILVUS_ADDRESS) return new Map()

  try {
    const client = await getMilvusClient()
    await ensureProjectProfileCollection(client)
    const result = await client.query({
      collection_name: collectionName,
      filter: 'repositoryId != ""',
      output_fields: ['repositoryId', 'profileHash'],
      limit: 10000,
    })

    return new Map(result.data.map((item) => [String(item.repositoryId), String(item.profileHash)]))
  } catch (error) {
    console.error(`${logPrefix}查询向量库记录失败:`, error instanceof Error ? error.message : String(error))
    return new Map()
  }
}

// 获取 Milvus 中最近一次向量入库的时间，作为「最后同步时间」展示给用户
export async function getLastIndexedAt(): Promise<number | null> {
  if (!process.env.MILVUS_ADDRESS) {
    return null
  }

  try {
    const client = await getMilvusClient()
    await ensureProjectProfileCollection(client)
    const result = await client.query({
      collection_name: collectionName,
      filter: 'repositoryId != ""',
      output_fields: ['indexedAt'],
      limit: 10000,
    })

    if (result.data.length === 0) {
      return null
    }

    return Math.max(...result.data.map((item) => Number(item.indexedAt ?? 0)))
  } catch (error) {
    console.error(`${logPrefix}查询最后同步时间失败:`, error instanceof Error ? error.message : String(error))

    return null
  }
}

// 清空项目简介向量集合中的所有数据
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

// 根据搜索过滤条件构建 Milvus 查询的 filter 表达式字符串
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

// 创建并返回 Milvus 客户端实例，并确保连接已建立
async function getMilvusClient() {
  const client = new MilvusClient({
    address: process.env.MILVUS_ADDRESS ?? 'localhost:19530',
    token: process.env.MILVUS_TOKEN,
  })
  await client.connectPromise

  return client
}

// 确保项目简介向量集合存在，若不存在则创建，若已存在则检查兼容性，最后加载集合到内存
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

// 检查已存在的集合字段是否与当前代码所需的 Schema 兼容，若不兼容则抛出错误
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

// 将单个项目的元数据拼接成用于生成向量嵌入的文本
function buildProjectProfileEmbeddingText(project: GithubProject) {
  return [
    `项目：${project.fullName}`,
    `语言：${project.language}`,
    `描述：${project.description}`,
    `项目简介：${project.projectSummary ?? ''}`,
  ].join('\n')
}

// 转义 Milvus filter 表达式中的特殊字符（双引号和反斜杠），防止注入或语法错误
function escapeMilvusString(value: string) {
  return value.replace(/["\\]/g, (matched) => `\\${matched}`)
}
