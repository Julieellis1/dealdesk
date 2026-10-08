// AES-256-GCM encryption for secrets at rest (API keys).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

let cachedKey = null;
function getKey() {
  if (cachedKey) return cachedKey;
  let secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    const file = path.join(config.dataDir, '.encryption_key');
    if (fs.existsSync(file)) {
      secret = fs.readFileSync(file, 'utf8').trim();
    } else {
      secret = crypto.randomBytes(32).toString('hex');
      fs.writeFileSync(file, secret, { mode: 0o600 });
      console.warn('[security] ENCRYPTION_KEY is not set. A random key was generated in data/.encryption_key.');
      console.warn('[security] Back it up, or copy it into .env as ENCRYPTION_KEY. Losing it means re-entering your API keys.');
    }
  }
  cachedKey = crypto.createHash('sha256').update(secret).digest();
  return cachedKey;
}

export function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':');
}

export function decrypt(blob) {
  if (!blob) return '';
  const [v, iv, tag, ct] = blob.split(':');
  if (v !== 'v1') throw new Error('Unknown secret format');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64')), decipher.final()]).toString('utf8');
}

export function maskKey(key) {
  if (!key) return '';
  if (key.length < 12) return '••••••••';
  return `${key.slice(0, 3)}••••••••${key.slice(-4)}`;
}

// Remove anything that looks like a secret from text before it is logged or returned.
export function redact(text, ...secrets) {
  let out = String(text ?? '');
  for (const s of secrets) if (s && s.length > 4) out = out.split(s).join('[redacted]');
  return out
    .replace(/\b(sk|pk|rk|gsk|xai)-[A-Za-z0-9_\-]{8,}/g, '$1-[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._\-]{8,}/gi, 'Bearer [redacted]');
}

export function randomToken(bytes = 18) {
  return crypto.randomBytes(bytes).toString('base64url');
}
