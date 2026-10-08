import { Router } from 'express';
import { db, parseJSON } from '../lib/db.js';
import { encrypt, decrypt, maskKey } from '../lib/crypto.js';
import { callModel } from '../lib/llm.js';

const r = Router();
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });

// Never send the key itself to the browser: only a masked preview.
function publicModel(m) {
  let masked = '';
  try { masked = maskKey(decrypt(m.api_key_enc)); } catch { masked = '(unreadable, re-enter)'; }
  return {
    id: m.id, provider: m.provider, model: m.model, base_url: m.base_url,
    priority: m.priority, enabled: !!m.enabled, has_key: !!m.api_key_enc, key_preview: masked,
    last_test: parseJSON(m.last_test, {}),
  };
}

const list = () => db.prepare('SELECT * FROM ai_models ORDER BY priority ASC, id ASC').all().map(publicModel);

function normalizePriorities() {
  const rows = db.prepare('SELECT id FROM ai_models ORDER BY priority ASC, id ASC').all();
  const upd = db.prepare('UPDATE ai_models SET priority = ? WHERE id = ?');
  db.transaction(() => rows.forEach((row, i) => upd.run(i + 1, row.id)))();
}

function validate(b, partial = false) {
  for (const k of ['provider', 'model', 'base_url']) {
    if (!partial || b[k] !== undefined) if (!String(b[k] || '').trim()) return `${k.replace('_', ' ')} is required`;
  }
  if (b.base_url !== undefined && !/^https?:\/\//i.test(String(b.base_url).trim())) return 'Base URL must start with http:// or https://';
  return null;
}

r.get('/', (req, res) => res.json(list()));

r.post('/', (req, res) => {
  const b = req.body || {};
  const err = validate(b);
  if (err) return bad(res, err);
  const max = db.prepare('SELECT COALESCE(MAX(priority), 0) AS m FROM ai_models').get().m;
  const priority = Number(b.priority) || max + 1;
  // Make room if inserting at an occupied priority.
  db.prepare('UPDATE ai_models SET priority = priority + 1 WHERE priority >= ?').run(priority);
  db.prepare('INSERT INTO ai_models (provider, model, base_url, api_key_enc, priority, enabled) VALUES (?,?,?,?,?,?)')
    .run(b.provider.trim(), b.model.trim(), b.base_url.trim(), b.api_key ? encrypt(b.api_key.trim()) : '', priority, b.enabled === false ? 0 : 1);
  normalizePriorities();
  res.status(201).json(list());
});

r.put('/:id', (req, res) => {
  const m = db.prepare('SELECT * FROM ai_models WHERE id = ?').get(req.params.id);
  if (!m) return bad(res, 'Model not found', 404);
  const b = req.body || {};
  const err = validate(b, true);
  if (err) return bad(res, err);
  const sets = [], vals = [];
  for (const k of ['provider', 'model', 'base_url']) if (b[k] !== undefined) { sets.push(`${k} = ?`); vals.push(String(b[k]).trim()); }
  if (b.enabled !== undefined) { sets.push('enabled = ?'); vals.push(b.enabled ? 1 : 0); }
  // api_key: undefined or '' = keep existing; clear_key = remove it.
  if (b.clear_key) { sets.push("api_key_enc = ''"); }
  else if (b.api_key) { sets.push('api_key_enc = ?'); vals.push(encrypt(String(b.api_key).trim())); }
  if (sets.length) db.prepare(`UPDATE ai_models SET ${sets.join(', ')} WHERE id = ?`).run(...vals, m.id);
  if (b.priority !== undefined && Number(b.priority) !== m.priority) {
    const ids = db.prepare('SELECT id FROM ai_models WHERE id != ? ORDER BY priority ASC, id ASC').all(m.id).map((x) => x.id);
    ids.splice(Math.max(0, Number(b.priority) - 1), 0, m.id);
    const upd = db.prepare('UPDATE ai_models SET priority = ? WHERE id = ?');
    db.transaction(() => ids.forEach((id, i) => upd.run(i + 1, id)))();
  }
  res.json(list());
});

r.post('/reorder', (req, res) => {
  const ids = (req.body?.ids || []).map(Number);
  const upd = db.prepare('UPDATE ai_models SET priority = ? WHERE id = ?');
  db.transaction(() => ids.forEach((id, i) => upd.run(i + 1, id)))();
  normalizePriorities();
  res.json(list());
});

r.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM ai_models WHERE id = ?').run(req.params.id);
  normalizePriorities();
  res.json(list());
});

r.post('/:id/test', async (req, res) => {
  const m = db.prepare('SELECT * FROM ai_models WHERE id = ?').get(req.params.id);
  if (!m) return bad(res, 'Model not found', 404);
  const started = Date.now();
  let result;
  try {
    const reply = await callModel(m, [{ role: 'user', content: 'Reply with the single word: OK' }], { maxTokens: 10, temperature: 0, timeoutMs: 20000 });
    result = { ok: true, ms: Date.now() - started, reply: reply.slice(0, 60), at: new Date().toISOString() };
  } catch (e) {
    result = { ok: false, ms: Date.now() - started, kind: e.kind, error: e.message, at: new Date().toISOString() };
  }
  db.prepare('UPDATE ai_models SET last_test = ? WHERE id = ?').run(JSON.stringify(result), m.id);
  res.json(result);
});

export default r;
