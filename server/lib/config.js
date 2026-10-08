import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });

export const config = {
  port: Number(process.env.PORT || 3001),
  host: process.env.HOST || '127.0.0.1',
  dataDir: path.resolve(ROOT, process.env.DATA_DIR || 'data'),
  publicUrl: (process.env.PUBLIC_URL || '').replace(/\/+$/, ''),
  appPassword: process.env.APP_PASSWORD || '',
  aiTimeoutMs: Number(process.env.AI_TIMEOUT_MS || 60000),
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || process.env.SMTP_USER || '',
  },
};

fs.mkdirSync(config.dataDir, { recursive: true });
