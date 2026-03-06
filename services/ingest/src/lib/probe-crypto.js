/**
 * AES-256-GCM encryption for probe auth headers.
 *
 * The encryption key (PROBE_ENCRYPTION_KEY env var) is a 64-char hex string
 * representing 32 bytes. It lives only on worker/ingest servers — never in the
 * DB or frontend.
 *
 * Ciphertext format stored in DB: base64(iv):base64(authTag):base64(ciphertext)
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const TAG_LENGTH = 16;

function getKey() {
  const hex = process.env.PROBE_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('PROBE_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypt a plaintext auth header value.
 * Returns a string safe for DB storage: "iv:tag:ciphertext" (all base64).
 */
export function encryptProbeAuth(plaintext) {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv, { authTagLength: TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/**
 * Decrypt a stored ciphertext back to the plaintext auth header.
 * Returns null if decryption fails (wrong key, tampered data, etc).
 */
export function decryptProbeAuth(stored) {
  if (!stored) return null;
  try {
    const key = getKey();
    const [ivB64, tagB64, cipherB64] = stored.split(':');
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const ciphertext = Buffer.from(cipherB64, 'base64');

    const decipher = createDecipheriv(ALGO, key, iv, { authTagLength: TAG_LENGTH });
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Create a masked hint for display.
 * "Bearer sk-ant-api03-abc...xyz" → "Bearer sk-ant-...xyz"
 */
export function maskAuthValue(headerValue) {
  if (!headerValue) return null;
  // Show first 12 chars and last 4 chars, mask the middle
  if (headerValue.length <= 20) {
    return headerValue.slice(0, 4) + '...' + headerValue.slice(-4);
  }
  return headerValue.slice(0, 12) + '...' + headerValue.slice(-4);
}
