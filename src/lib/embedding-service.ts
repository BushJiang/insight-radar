interface SiliconFlowEmbeddingResponse {
  data?: Array<{
    embedding?: unknown
    index?: number
  }>
}

const defaultSiliconFlowBaseUrl = 'https://api.siliconflow.cn/v1'
const defaultEmbeddingModel = 'BAAI/bge-m3'
const defaultEmbeddingVersion = 'siliconflow-bge-m3-1024-v1'
const defaultVectorDimension = 1024
const defaultEmbeddingBatchSize = 20
const defaultEmbeddingTimeoutMs = 30_000

export function getProjectProfileEmbeddingModel() {
  return process.env.PROJECT_PROFILE_EMBEDDING_MODEL || defaultEmbeddingModel
}

export function getProjectProfileEmbeddingVersion() {
  return process.env.PROJECT_PROFILE_EMBEDDING_VERSION || defaultEmbeddingVersion
}

export function getProjectProfileVectorDimension() {
  const dimension = Number(process.env.PROJECT_PROFILE_VECTOR_DIMENSION || defaultVectorDimension)

  if (dimension !== defaultVectorDimension) {
    throw new Error(`PROJECT_PROFILE_VECTOR_DIMENSION 必须为 ${defaultVectorDimension}，当前为 ${dimension}。`)
  }

  return dimension
}

export function getProjectProfileEmbeddingBatchSize() {
  const batchSize = Number(process.env.PROJECT_PROFILE_EMBEDDING_BATCH_SIZE || defaultEmbeddingBatchSize)

  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error(`PROJECT_PROFILE_EMBEDDING_BATCH_SIZE 必须为正整数，当前为 ${process.env.PROJECT_PROFILE_EMBEDDING_BATCH_SIZE}。`)
  }

  return batchSize
}

export async function embedProjectProfileTexts(texts: string[]) {
  const normalizedTexts = texts.map((text) => text.trim())

  if (normalizedTexts.some((text) => !text)) {
    throw new Error('项目简介向量化文本不能为空。')
  }

  const batchSize = getProjectProfileEmbeddingBatchSize()
  const embeddings: number[][] = []

  for (let index = 0; index < normalizedTexts.length; index += batchSize) {
    const batch = normalizedTexts.slice(index, index + batchSize)
    embeddings.push(...await requestEmbeddings(batch))
  }

  return embeddings
}

export async function embedProjectProfileQuery(query: string) {
  const [embedding] = await embedProjectProfileTexts([query])

  return embedding
}

async function requestEmbeddings(input: string[]) {
  const apiKey = process.env.SILICONFLOW_API_KEY

  if (!apiKey) {
    throw new Error('缺少 SILICONFLOW_API_KEY，无法生成项目简介向量。')
  }

  const baseUrl = (process.env.SILICONFLOW_BASE_URL || defaultSiliconFlowBaseUrl).replace(/\/$/, '')
  const timeoutMs = Number(process.env.PROJECT_PROFILE_EMBEDDING_TIMEOUT_MS || defaultEmbeddingTimeoutMs)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: getProjectProfileEmbeddingModel(),
        input,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`SiliconFlow embedding 请求失败：HTTP ${response.status}`)
    }

    const payload = await response.json() as SiliconFlowEmbeddingResponse
    const data = payload.data ?? []

    if (data.length !== input.length) {
      throw new Error(`SiliconFlow embedding 返回数量不匹配：期望 ${input.length}，实际 ${data.length}。`)
    }

    return data
      .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
      .map((item) => normalizeEmbedding(item.embedding))
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`SiliconFlow embedding 请求超时：${timeoutMs}ms。`)
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function normalizeEmbedding(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error('SiliconFlow embedding 返回格式错误：embedding 不是数组。')
  }

  const embedding = value.map((item) => Number(item))
  const dimension = getProjectProfileVectorDimension()

  if (embedding.length !== dimension) {
    throw new Error(`SiliconFlow embedding 维度错误：期望 ${dimension}，实际 ${embedding.length}。`)
  }

  if (embedding.some((item) => !Number.isFinite(item))) {
    throw new Error('SiliconFlow embedding 包含非数字值。')
  }

  return embedding
}
