import crypto from 'crypto';
import { getJson, setJson, getLocalJson, setLocalJson } from '@/lib/blobData';

function normalizeKey(raw?: string): Buffer {
  const keyRaw = (raw ?? process.env.USERS_CRYPTO_KEY ?? '').replace(/^"+|"+$/g, '').replace(/^'+|'+$/g, '').trim();
  if (!keyRaw) throw new Error('Missing USERS_CRYPTO_KEY');
  // Try base64
  try {
    const b64 = Buffer.from(keyRaw, 'base64');
    if (b64.length === 32) return b64;
  } catch {}
  // Try hex
  try {
    const hex = Buffer.from(keyRaw, 'hex');
    if (hex.length === 32) return hex;
  } catch {}
  // Fallback: derive 32-byte key from string via SHA-256
  return crypto.createHash('sha256').update(keyRaw, 'utf8').digest();
}

export async function getEncryptedJson<T = any>(name: string, key?: string): Promise<T | null> {
  const wrapped = await getJson<any>(name);
  if (!wrapped) return null;
  // If already plain JSON with expected shape, return as-is (legacy support)
  if (typeof wrapped === 'object' && wrapped !== null && 'users' in wrapped) {
    // Attempt one-time migration: encrypt and persist to blob
    try {
      await setEncryptedJson(name, wrapped, key);
    } catch {}
    return wrapped as T;
  }
  if (!(wrapped && wrapped.version === 1 && wrapped.scheme === 'AES-256-GCM' && wrapped.payload)) {
    // Unknown shape; return as-is
    return wrapped as T;
  }
  const keyBuf = normalizeKey(key);
  const iv = Buffer.from(wrapped.payload.iv, 'base64');
  const tag = Buffer.from(wrapped.payload.tag, 'base64');
  const ct = Buffer.from(wrapped.payload.ct, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, iv);
  decipher.setAuthTag(tag);
  const buf = Buffer.concat([decipher.update(ct), decipher.final()]);
  return JSON.parse(buf.toString('utf8')) as T;
}

export async function setEncryptedJson(name: string, value: any, key?: string): Promise<string> {
  const keyBuf = normalizeKey(key);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuf, iv);
  const json = Buffer.from(JSON.stringify(value), 'utf8');
  const ct = Buffer.concat([cipher.update(json), cipher.final()]);
  const tag = cipher.getAuthTag();
  const wrapped = {
    version: 1,
    scheme: 'AES-256-GCM',
    payload: {
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      ct: ct.toString('base64'),
    },
  };
  return await setJson(name, wrapped);
}

// Local-only variants to avoid any online/blob interactions
export async function getEncryptedJsonLocal<T = any>(name: string, key?: string): Promise<T | null> {
  const wrapped = getLocalJson<any>(name);
  if (!wrapped) return null;
  if (typeof wrapped === 'object' && wrapped !== null && 'users' in wrapped) {
    return wrapped as T;
  }
  if (!(wrapped && wrapped.version === 1 && wrapped.scheme === 'AES-256-GCM' && wrapped.payload)) {
    return wrapped as T;
  }
  const keyBuf = normalizeKey(key);
  const iv = Buffer.from(wrapped.payload.iv, 'base64');
  const tag = Buffer.from(wrapped.payload.tag, 'base64');
  const ct = Buffer.from(wrapped.payload.ct, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, iv);
  decipher.setAuthTag(tag);
  const buf = Buffer.concat([decipher.update(ct), decipher.final()]);
  return JSON.parse(buf.toString('utf8')) as T;
}

export async function setEncryptedJsonLocal(name: string, value: any, key?: string): Promise<void> {
  const keyBuf = normalizeKey(key);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuf, iv);
  const json = Buffer.from(JSON.stringify(value), 'utf8');
  const ct = Buffer.concat([cipher.update(json), cipher.final()]);
  const tag = cipher.getAuthTag();
  const wrapped = {
    version: 1,
    scheme: 'AES-256-GCM',
    payload: {
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      ct: ct.toString('base64'),
    },
  };
  setLocalJson(name, wrapped);
}