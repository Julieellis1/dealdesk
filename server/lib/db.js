import Database from 'better-sqlite3';
import path from 'node:path';
import { config } from './config.js';

export const db = new Database(path.join(config.dataDir, 'dealdesk.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  company TEXT DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  tax_id TEXT DEFAULT '',
  payment_method TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL DEFAULT 'Untitled contract',
  status TEXT NOT NULL DEFAULT 'draft',          -- draft | negotiating | agreed | submitted
  signed INTEGER NOT NULL DEFAULT 0,
  wizard_step INTEGER NOT NULL DEFAULT 1,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  contract_text TEXT DEFAULT '',
  terms TEXT DEFAULT '{}',       -- scope, payment_terms, deadlines, penalties, termination, ip
  job TEXT DEFAULT '{}',         -- deliverables, dates, milestones, pricing type, rate, expenses
  pricing TEXT DEFAULT '{}',     -- negotiation context + agreed terms
  ai TEXT DEFAULT '{}',          -- saved AI outputs (summary, pricing advice, scripts, checklist...)
  final_summary TEXT DEFAULT '',
  submitted_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS negotiation_rounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  round_date TEXT NOT NULL,
  party TEXT NOT NULL,           -- me | client
  kind TEXT NOT NULL,            -- offer | counter | accepted | rejected | note
  amount REAL,
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  contract_id INTEGER REFERENCES contracts(id) ON DELETE CASCADE,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'single',   -- single | deposit | milestone | recurring
  status TEXT NOT NULL DEFAULT 'draft',  -- draft | sent | paid   (overdue is computed)
  issue_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  items TEXT NOT NULL DEFAULT '[]',
  tax_rate REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  payment_instructions TEXT DEFAULT '',
  recurrence TEXT DEFAULT '{}',          -- { interval: weekly|monthly|quarterly, next_date }
  share_token TEXT UNIQUE,
  sent_at TEXT,
  paid_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS ai_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_key_enc TEXT DEFAULT '',
  priority INTEGER NOT NULL DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_test TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_inv_contract ON invoices(contract_id);
CREATE INDEX IF NOT EXISTS idx_rounds_contract ON negotiation_rounds(contract_id);
`);

export function parseJSON(v, fallback) {
  if (v == null || v === '') return fallback;
  try { return JSON.parse(v); } catch { return fallback; }
}

export function getSetting(key, fallback = {}) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? parseJSON(row.value, fallback) : fallback;
}

export function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, JSON.stringify(value));
}
