import { readBrowserStorage } from '@/lib/browser-storage'
import type { UserApiKeys } from '@/types/insight-radar'

export const apiKeysStorageKey = 'insight-radar-api-keys'
export const legacyGithubTokenStorageKey = 'insight-radar-github-token'
export const emptyApiKeys: UserApiKeys = { githubToken: '', deepseekApiKey: '', siliconFlowApiKey: '' }

export function readSavedApiKeys(): UserApiKeys {
  const savedApiKeys = readBrowserStorage<Partial<UserApiKeys>>(apiKeysStorageKey, {})
  const legacyGithubToken = readBrowserStorage(legacyGithubTokenStorageKey, '')

  return {
    githubToken: savedApiKeys.githubToken ?? legacyGithubToken,
    deepseekApiKey: savedApiKeys.deepseekApiKey ?? '',
    siliconFlowApiKey: savedApiKeys.siliconFlowApiKey ?? '',
  }
}
