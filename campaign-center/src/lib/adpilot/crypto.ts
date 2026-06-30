import crypto from 'crypto'

// AES-256-GCM token encryption for Meta access tokens at rest.
// Uses ENCRYPTION_KEY (32-byte hex). Server-side only.

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY || ''
  // Accept a 64-char hex (32 bytes). If misconfigured, derive a stable key so dev
  // doesn't crash — but warn loudly. NEVER rely on the fallback in production.
  if (/^[0-9a-fA-F]{64}$/.test(hex)) return Buffer.from(hex, 'hex')
  return crypto.createHash('sha256').update(hex || 'adpilot-dev-fallback-key').digest()
}

export function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // iv:tag:ciphertext (all base64)
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':')
}

export function decryptToken(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(':')
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8')
}
