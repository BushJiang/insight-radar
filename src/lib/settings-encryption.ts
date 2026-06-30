import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const algorithm = 'aes-256-gcm'
const ivLength = 12
const authTagLength = 16

export function encryptSettingSecret(value: string) {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return null
  }

  const key = getEncryptionKey()
  const iv = randomBytes(ivLength)
  const cipher = createCipheriv(algorithm, key, iv)
  const encrypted = Buffer.concat([cipher.update(trimmedValue, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

export function decryptSettingSecret(value: string | null | undefined) {
  if (!value) {
    return ''
  }

  const payload = Buffer.from(value, 'base64')
  const iv = payload.subarray(0, ivLength)
  const authTag = payload.subarray(ivLength, ivLength + authTagLength)
  const encrypted = payload.subarray(ivLength + authTagLength)
  const decipher = createDecipheriv(algorithm, getEncryptionKey(), iv)
  decipher.setAuthTag(authTag)

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

function getEncryptionKey() {
  const rawKey = process.env.SETTINGS_ENCRYPTION_KEY

  if (!rawKey) {
    throw new Error('缺少 SETTINGS_ENCRYPTION_KEY 环境变量，无法保存或读取加密设置。')
  }

  if (rawKey.length === 64 && /^[0-9a-f]+$/i.test(rawKey)) {
    return Buffer.from(rawKey, 'hex')
  }

  return createHash('sha256').update(rawKey).digest()
}
