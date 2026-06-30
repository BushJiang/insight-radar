import { eq } from 'drizzle-orm'
import { appSettings } from '@/lib/db/schema'
import { getDb } from '@/lib/db/client'
import { normalizePreference } from '@/lib/default-preference'
import type { UserApiKeys, UserPreference } from '@/types/insight-radar'

const defaultSettingsId = 'default'

export interface AppSettingsSnapshot {
  preference: UserPreference
  apiKeyStatus: Record<keyof UserApiKeys, boolean>
}

export interface SaveAppSettingsInput {
  preference?: Partial<UserPreference>
  apiKeys?: Partial<UserApiKeys>
}

export async function getAppSettingsSnapshot(): Promise<AppSettingsSnapshot> {
  const record = await getAppSettingsRecord()
  const preference = normalizePreference(record?.preference)

  return {
    preference,
    apiKeyStatus: {
      githubToken: Boolean(record?.githubToken),
      deepseekApiKey: Boolean(record?.deepseekApiKey),
      siliconFlowApiKey: Boolean(record?.siliconFlowApiKey),
    },
  }
}

export async function getRuntimeApiKeys(): Promise<UserApiKeys> {
  const record = await getOptionalAppSettingsRecord()

  return {
    githubToken: record?.githubToken ?? '',
    deepseekApiKey: record?.deepseekApiKey ?? '',
    siliconFlowApiKey: record?.siliconFlowApiKey ?? '',
  }
}

export async function getRuntimePreference(inputPreference?: Partial<UserPreference>): Promise<UserPreference> {
  if (inputPreference) {
    return normalizePreference(inputPreference)
  }

  const record = await getAppSettingsRecord()

  return normalizePreference(record?.preference)
}

export async function saveAppSettings(input: SaveAppSettingsInput): Promise<AppSettingsSnapshot> {
  const current = await getAppSettingsRecord()
  const now = new Date()
  const nextPreference = input.preference ? normalizePreference(input.preference) : normalizePreference(current?.preference)
  const nextValues = {
    id: defaultSettingsId,
    preference: nextPreference,
    githubToken: resolvePlainSecret(input.apiKeys?.githubToken, current?.githubToken),
    deepseekApiKey: resolvePlainSecret(input.apiKeys?.deepseekApiKey, current?.deepseekApiKey),
    siliconFlowApiKey: resolvePlainSecret(input.apiKeys?.siliconFlowApiKey, current?.siliconFlowApiKey),
    updatedAt: now,
  }

  if (current) {
    await getDb().update(appSettings).set(nextValues).where(eq(appSettings.id, defaultSettingsId))
  } else {
    await getDb().insert(appSettings).values({ ...nextValues, createdAt: now })
  }

  return getAppSettingsSnapshot()
}

async function getAppSettingsRecord() {
  const [record] = await getDb().select().from(appSettings).where(eq(appSettings.id, defaultSettingsId)).limit(1)

  return record ?? null
}

async function getOptionalAppSettingsRecord() {
  if (!process.env.DATABASE_URL) {
    return null
  }

  return getAppSettingsRecord()
}

function resolvePlainSecret(value: string | undefined, currentValue: string | null | undefined) {
  const trimmedValue = value?.trim()

  if (!trimmedValue) {
    return currentValue ?? null
  }

  return trimmedValue
}
