import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

interface ColumnInfo {
  table_name: string
  column_name: string
  data_type: string
  is_nullable: string
  character_maximum_length: number | null
}

interface IndexInfo {
  tablename: string
  indexname: string
}

const expectedColumns = new Map([
  ['projects.id', { type: 'text', nullable: false, length: null }],
  ['projects.repository_id', { type: 'text', nullable: false, length: null }],
  ['projects.name', { type: 'text', nullable: false, length: null }],
  ['projects.full_name', { type: 'text', nullable: false, length: null }],
  ['projects.description', { type: 'text', nullable: false, length: null }],
  ['projects.source_url', { type: 'text', nullable: false, length: null }],
  ['projects.language', { type: 'text', nullable: false, length: null }],
  ['projects.topics', { type: 'jsonb', nullable: false, length: null }],
  ['projects.stars', { type: 'integer', nullable: false, length: null }],
  ['projects.forks', { type: 'integer', nullable: false, length: null }],
  ['projects.issues', { type: 'integer', nullable: false, length: null }],
  ['projects.license', { type: 'text', nullable: true, length: null }],
  ['projects.is_fork', { type: 'boolean', nullable: false, length: null }],
  ['projects.source_repository_full_name', { type: 'text', nullable: true, length: null }],
  ['projects.source_repository_url', { type: 'text', nullable: true, length: null }],
  ['projects.source_github_username', { type: 'text', nullable: false, length: null }],
  ['projects.star_at', { type: 'timestamp with time zone', nullable: false, length: null }],
  ['projects.pushed_at', { type: 'timestamp with time zone', nullable: true, length: null }],
  ['projects.github_updated_at', { type: 'timestamp with time zone', nullable: false, length: null }],
  ['projects.readme_content', { type: 'text', nullable: true, length: null }],
  ['projects.readme_hash', { type: 'character varying', nullable: true, length: 64 }],
  ['projects.readme_summary', { type: 'character varying', nullable: true, length: 300 }],
  ['projects.match_reason', { type: 'text', nullable: false, length: null }],
  ['projects.maturity', { type: 'text', nullable: false, length: null }],
  ['projects.collection_job_id', { type: 'text', nullable: false, length: null }],
  ['projects.notes', { type: 'text', nullable: true, length: null }],
  ['projects.created_at', { type: 'timestamp with time zone', nullable: false, length: null }],
  ['projects.updated_at', { type: 'timestamp with time zone', nullable: false, length: null }],
  ['projects.deleted_at', { type: 'timestamp with time zone', nullable: true, length: null }],
  ['app_settings.id', { type: 'text', nullable: false, length: null }],
  ['app_settings.github_token', { type: 'text', nullable: true, length: null }],
  ['app_settings.deepseek_api_key', { type: 'text', nullable: true, length: null }],
  ['app_settings.siliconflow_api_key', { type: 'text', nullable: true, length: null }],
  ['app_settings.preference', { type: 'jsonb', nullable: true, length: null }],
  ['app_settings.created_at', { type: 'timestamp with time zone', nullable: false, length: null }],
  ['app_settings.updated_at', { type: 'timestamp with time zone', nullable: false, length: null }],
])

const expectedIndexes = new Set([
  'projects_pkey',
  'projects_repository_id_unique',
  'projects_full_name_unique',
  'projects_name_index',
  'projects_source_github_username_index',
  'app_settings_pkey',
])

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error('缺少 DATABASE_URL，请先复制 .env.example 为 .env，并配置 PostgreSQL 连接地址。')
  process.exit(1)
}

const currentDir = dirname(fileURLToPath(import.meta.url))
const schemaPath = resolve(currentDir, '../src/lib/db/migrations/init_schema.sql')
const sql = postgres(databaseUrl, { max: 1 })

try {
  const schema = await readFile(schemaPath, 'utf8')

  await sql.unsafe(schema)
  await assertSchemaReady()
  console.log('数据库初始化完成。')
} catch (error) {
  console.error('数据库初始化失败：', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
} finally {
  await sql.end()
}

async function assertSchemaReady() {
  const columns = await sql<ColumnInfo[]>`
    SELECT table_name, column_name, data_type, is_nullable, character_maximum_length
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('projects', 'app_settings')
  `
  const indexes = await sql<IndexInfo[]>`
    SELECT tablename, indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename IN ('projects', 'app_settings')
  `
  const actualColumns = new Map(columns.map((column) => [`${column.table_name}.${column.column_name}`, column]))
  const actualIndexes = new Set(indexes.map((index) => index.indexname))
  const problems: string[] = []

  for (const [key, expected] of expectedColumns) {
    const actual = actualColumns.get(key)

    if (!actual) {
      problems.push(`缺少字段 ${key}`)
      continue
    }

    const actualNullable = actual.is_nullable === 'YES'

    if (actual.data_type !== expected.type) {
      problems.push(`${key} 类型应为 ${expected.type}，当前为 ${actual.data_type}`)
    }

    if (actualNullable !== expected.nullable) {
      problems.push(`${key} 可空性应为 ${expected.nullable ? '可空' : '非空'}，当前为 ${actualNullable ? '可空' : '非空'}`)
    }

    if (actual.character_maximum_length !== expected.length) {
      problems.push(`${key} 长度应为 ${expected.length ?? '无限制'}，当前为 ${actual.character_maximum_length ?? '无限制'}`)
    }
  }

  for (const indexName of expectedIndexes) {
    if (!actualIndexes.has(indexName)) {
      problems.push(`缺少索引 ${indexName}`)
    }
  }

  if (problems.length > 0) {
    throw new Error(`数据库结构和当前应用不一致，请使用空数据库重新初始化，或手动处理旧结构迁移。\n${problems.map((problem) => `- ${problem}`).join('\n')}`)
  }
}
