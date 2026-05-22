import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const HEX_KEY = /^[0-9a-fA-F]{64}$/;

function loadKey(hexKey?: string): Buffer {
  const raw = hexKey ?? process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error('ENCRYPTION_KEY is not set');
  if (!HEX_KEY.test(raw)) throw new Error('ENCRYPTION_KEY must be 64 hex chars (32 bytes)');
  return Buffer.from(raw, 'hex');
}

/**
 * Encrypt a UTF-8 string with AES-256-GCM. Returns a `Uint8Array<ArrayBuffer>` in the format:
 *   [ iv (12 bytes) | auth tag (16 bytes) | ciphertext (n bytes) ]
 * Persist as bytea (Prisma `Bytes`). A fresh random IV per call.
 *
 * Note: returns Uint8Array (not Buffer) because Prisma 6 typings reject
 * Buffer<ArrayBufferLike> for Bytes columns (must be backed by ArrayBuffer,
 * not SharedArrayBuffer).
 */
export function encryptSecret(plaintext: string, hexKey?: string): Uint8Array<ArrayBuffer> {
  const key = loadKey(hexKey);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Backed by ArrayBuffer (not SharedArrayBuffer) so Prisma Bytes typings accept it.
  const buffer = new ArrayBuffer(IV_LEN + TAG_LEN + ciphertext.length);
  const out = new Uint8Array(buffer);
  out.set(iv, 0);
  out.set(tag, IV_LEN);
  out.set(ciphertext, IV_LEN + TAG_LEN);
  return out;
}

/** Inverse of `encryptSecret`. Throws on tampered ciphertext (GCM auth tag check). */
export function decryptSecret(blob: Buffer | Uint8Array, hexKey?: string): string {
  const key = loadKey(hexKey);
  const buf = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
  if (buf.length < IV_LEN + TAG_LEN) {
    throw new Error('Encrypted blob too short');
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
