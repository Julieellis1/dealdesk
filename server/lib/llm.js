// OpenAI-compatible chat completions with priority-ordered fallback.
// API keys are decrypted only here, on the server, at request time. They never reach the browser or the logs.
import { db } from './db.js';
import { decrypt, redact } from './crypto.js';
import { config } from './config.js';

export class AIError extends Error {
  constructor(message, attempts = []) {
    super(message);
    this.attempts = attempts;
    this.status = 502;
  }
}

class CallError extends Error {
  constructor(message, kind) { super(message); this.kind = kind; }
}

const KIND_LABEL = {
  timeout: 'Timed out',
  rate_limit: 'Rate limited',
  auth: 'API key rejected',
  server: 'Provider error',
  network: 'Could not connect',
  request: 'Request rejected',
  empty: 'Empty answer',
  bad_output: 'Unusable answer',
};

export function chatUrl(baseUrl) {
  const base = String(baseUrl || '').trim().replace(/\/+$/, '');
  return base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
}

export async function callModel(m, messages, { temperature = 0.3, maxTokens, timeoutMs } = {}) {
  let key = '';
  try { key = m.api_key_enc ? decrypt(m.api_key_enc) : ''; }
  catch { throw new CallError('Stored API key could not be decrypted (was ENCRYPTION_KEY changed?). Re-enter the key.', 'auth'); }

  const url = chatUrl(m.base_url);
  const ctrl = new AbortController();
  const limit = timeoutMs || config.aiTimeoutMs;
  const timer = setTimeout(() => ctrl.abort(), limit);
  try {
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
        body: JSON.stringify({ model: m.model, messages, temperature, ...(maxTokens ? { max_tokens: maxTokens } : {}) }),
        signal: ctrl.signal,
      });
    } catch (e) {
      if (e.name === 'AbortError') throw new CallError(`No answer within ${Math.round(limit / 1000)}s`, 'timeout');
      throw new CallError(redact(`Could not reach ${url} (${e.cause?.code || e.message})`, key), 'network');
    }
    const text = await res.text();
    if (!res.ok) {
      const kind = res.status === 429 ? 'rate_limit'
        : (res.status === 401 || res.status === 403) ? 'auth'
        : res.status >= 500 ? 'server' : 'request';
      let msg = text.slice(0, 300);
      try { const j = JSON.parse(text); msg = j.error?.message || j.message || j.error || msg; } catch { /* not JSON */ }
      throw new CallError(redact(`HTTP ${res.status}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`, key), kind);
    }
    let data;
    try { data = JSON.parse(text); } catch { throw new CallError('Provider returned something that is not JSON', 'bad_output'); }
    const content = data.choices?.[0]?.message?.content;
    if (!content || !String(content).trim()) throw new CallError('The model returned an empty answer', 'empty');
    return String(content);
  } catch (e) {
    if (e.name === 'AbortError') throw new CallError(`No answer within ${Math.round(limit / 1000)}s`, 'timeout');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Try each enabled model in priority order (1 = first). Any error, timeout, rate limit,
 * or an answer that fails `validate` moves on to the next model.
 * Returns { content, parsed, model, attempts }.
 */
export async function chat(messages, { validate, temperature, maxTokens } = {}) {
  const models = db.prepare('SELECT * FROM ai_models WHERE enabled = 1 ORDER BY priority ASC, id ASC').all();
  if (!models.length) {
    throw new AIError('No AI model is switched on yet. Open Settings → AI Models, add a model, and switch it on.');
  }
  const attempts = [];
  for (const m of models) {
    const started = Date.now();
    try {
      const content = await callModel(m, messages, { temperature, maxTokens });
      let parsed;
      if (validate) {
        try { parsed = validate(content); }
        catch (e) { throw new CallError(`Answer could not be used: ${e.message}`, 'bad_output'); }
      }
      attempts.push({ provider: m.provider, model: m.model, ok: true, ms: Date.now() - started });
      return { content, parsed, model: { id: m.id, provider: m.provider, model: m.model }, attempts };
    } catch (e) {
      const kind = e.kind || 'network';
      attempts.push({ provider: m.provider, model: m.model, ok: false, kind, label: KIND_LABEL[kind] || 'Error', error: e.message, ms: Date.now() - started });
      console.warn(`[ai] ${m.provider}/${m.model} failed (${kind}): ${e.message}`);
    }
  }
  throw new AIError(
    attempts.length === 1
      ? 'Your AI model did not answer. See the reason below, then check Settings → AI Models.'
      : `All ${attempts.length} enabled AI models failed. See each reason below, then check Settings → AI Models.`,
    attempts,
  );
}

export function extractJSON(text) {
  let t = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(t); } catch { /* fall through */ }
  const start = t.search(/[{[]/);
  const end = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (start === -1 || end <= start) throw new Error('no JSON object found');
  return JSON.parse(t.slice(start, end + 1));
}

export const jsonValidator = (requiredKeys = []) => (content) => {
  const obj = extractJSON(content);
  for (const k of requiredKeys) if (!(k in obj)) throw new Error(`missing "${k}"`);
  return obj;
};
