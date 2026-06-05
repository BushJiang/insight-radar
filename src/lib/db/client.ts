import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@/lib/db/schema'

let database: ReturnType<typeof drizzle<typeof schema>> | null = null

export function getDb() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('缺少 DATABASE_URL 环境变量，请在 .env.local 中配置本地 PostgreSQL 连接。')
  }

  if (!database) {
    const client = postgres(connectionString, { prepare: false })
    database = drizzle(client, { schema })
  }

  return database
}
