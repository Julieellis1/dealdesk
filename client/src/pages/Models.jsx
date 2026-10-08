import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Card, PageHeader, Button, Field, Input, Select, Toggle, Empty, Modal, useToast, cx } from '../components/ui.jsx';

const PRESETS = [
  { provider: 'OpenAI', base_url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { provider: 'OpenRouter', base_url: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
  { provider: 'Groq', base_url: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  { provider: 'DeepSeek', base_url: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { provider: 'Mistral', base_url: 'https://api.mistral.ai/v1', model: 'mistral-small-latest' },
  { provider: 'Google Gemini', base_url: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.0-flash' },
  { provider: 'Together AI', base_url: 'https://api.together.xyz/v1', model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
  { provider: 'Ollama (local)', base_url: 'http://localhost:11434/v1', model: 'llama3.1' },
  { provider: 'Mock (testing)', base_url: 'http://127.0.0.1:4010/v1', model: 'mock-coach' },
];
const BLANK = { provider: '', model: '', base_url: '', api_key: '', priority: '', enabled: true };

function KeyInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex gap-2">
      <Input type={show ? 'text' : 'password'} autoComplete="new-password" spellCheck={false} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      <Button type="button" variant="secondary" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide key' : 'Show key'}>{show ? 'Hide' : 'Show'}</Button>
    </div>
  );
}

export default function Models() {
  const [models, setModels] = useState(null);
  const [edit, setEdit] = useState(null); // {…model} or BLANK
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState({});
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const toast = useToast();
  const load = () => api.get('/models').then(setModels);
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      const body = { ...edit, priority: edit.priority === '' ? undefined : Number(edit.priority) };
      if (!body.api_key) delete body.api_key; // keep the stored key
      setModels(edit.id ? await api.put(`/models/${edit.id}`, body) : await api.post('/models', body));
      toast('Model saved'); setEdit(null);
    } catch (e) { toast(e.message, 'error'); } finally { setSaving(false); }
  };
  const toggle = async (m, enabled) => setModels(await api.put(`/models/${m.id}`, { enabled }));
  const del = async (m) => { if (confirm(`Delete ${m.provider} · ${m.model}? Its stored key is erased too.`)) setModels(await api.del(`/models/${m.id}`)); };
  const test = async (m) => {
    setTesting((t) => ({ ...t, [m.id]: true }));
    try { const r = await api.post(`/models/${m.id}/test`); toast(r.ok ? `${m.provider} answered in ${r.ms} ms ✓` : `${m.provider} failed: ${r.error}`, r.ok ? 'ok' : 'error'); }
    finally { setTesting((t) => ({ ...t, [m.id]: false })); load(); }
  };
  const reorder = async (ids) => {
    setModels((ms) => ids.map((id, i) => ({ ...ms.find((m) => m.id === id), priority: i + 1 })));
    setModels(await api.post('/models/reorder', { ids }));
  };
  const move = (idx, dir) => {
    const ids = models.map((m) => m.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    reorder(ids);
  };
  const onDrop = (targetId) => {
    if (!dragId || dragId === targetId) return;
    const ids = models.map((m) => m.id).filter((id) => id !== dragId);
    ids.splice(ids.indexOf(targetId) + (models.findIndex((m) => m.id === dragId) < models.findIndex((m) => m.id === targetId) ? 1 : 0), 0, dragId);
    setDragId(null); setOverId(null);
    reorder(ids);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="AI Models" subtitle={<><Link to="/settings" className="text-indigo-600">Settings</Link> / AI Models</>}
        actions={<Button onClick={() => setEdit({ ...BLANK })}>＋ Add model</Button>} />

      <Card className="!bg-slate-900 !text-slate-100 !border-slate-900">
        <p className="font-semibold">How the stack works</p>
        <p className="mt-1 text-sm text-slate-300">Every AI request goes to priority <b>1</b> first. If it errors, times out or hits a rate limit, the next enabled model answers automatically. Each AI answer shows which model replied. Keys are encrypted on the server and never sent back to this page.</p>
      </Card>

      {!models ? <p className="text-slate-500">Loading…</p> : !models.length ? (
        <Empty title="No AI models yet">Add any OpenAI-compatible model (OpenAI, OpenRouter, Groq, Gemini, Ollama…). Use a preset to fill the address for you.</Empty>
      ) : (
        <ul className="space-y-3">
          {models.map((m, idx) => (
            <li key={m.id} draggable onDragStart={() => setDragId(m.id)} onDragEnd={() => { setDragId(null); setOverId(null); }}
              onDragOver={(e) => { e.preventDefault(); setOverId(m.id); }} onDrop={() => onDrop(m.id)}
              className={cx('rounded-2xl border bg-white p-4 shadow-sm transition', overId === m.id && dragId !== m.id ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200', dragId === m.id && 'opacity-50', !m.enabled && 'bg-slate-50')}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <span className="cursor-grab select-none text-xl text-slate-300" title="Drag to reorder">⋮⋮</span>
                  <span className={cx('grid h-9 w-9 place-items-center rounded-full text-sm font-bold', m.enabled ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500')}>{m.priority}</span>
                  <div className="flex flex-col sm:hidden">
                    <button className="text-xs text-slate-500" onClick={() => move(idx, -1)} aria-label="Move up">▲</button>
                    <button className="text-xs text-slate-500" onClick={() => move(idx, 1)} aria-label="Move down">▼</button>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{m.provider} <span className="font-normal text-slate-500">· {m.model}</span></p>
                  <p className="truncate text-xs text-slate-500">{m.base_url}</p>
                  <p className="text-xs text-slate-500">Key: {m.has_key ? <code>{m.key_preview}</code> : 'none'}
                    {m.last_test?.at && <span className={m.last_test.ok ? 'text-emerald-600' : 'text-red-600'}> · last test {m.last_test.ok ? `OK (${m.last_test.ms} ms)` : `failed: ${m.last_test.error}`}</span>}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="hidden gap-1 sm:flex">
                    <Button size="sm" variant="ghost" onClick={() => move(idx, -1)} disabled={idx === 0} aria-label="Move up">▲</Button>
                    <Button size="sm" variant="ghost" onClick={() => move(idx, 1)} disabled={idx === models.length - 1} aria-label="Move down">▼</Button>
                  </span>
                  <Toggle checked={m.enabled} onChange={(v) => toggle(m, v)} label="Enabled" />
                  <Button size="sm" variant="secondary" loading={testing[m.id]} onClick={() => test(m)}>Test connection</Button>
                  <Button size="sm" variant="secondary" onClick={() => setEdit({ ...m, api_key: '' })}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => del(m)}>Delete</Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit model' : 'Add a model'} wide>
        {edit && (
          <div className="space-y-3">
            {!edit.id && (
              <Field label="Start from a preset (optional)">
                <Select value="" onChange={(e) => { const p = PRESETS[e.target.value]; if (p) setEdit({ ...edit, ...p }); }}>
                  <option value="">Choose a provider…</option>
                  {PRESETS.map((p, i) => <option key={p.provider} value={i}>{p.provider}</option>)}
                </Select>
              </Field>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Provider name"><Input value={edit.provider} onChange={(e) => setEdit({ ...edit, provider: e.target.value })} placeholder="OpenAI" /></Field>
              <Field label="Model name" hint="Exactly as the provider spells it."><Input value={edit.model} onChange={(e) => setEdit({ ...edit, model: e.target.value })} placeholder="gpt-4o-mini" /></Field>
              <Field label="Base URL" className="sm:col-span-2" hint="The address ending in /v1 (we add /chat/completions)."><Input value={edit.base_url} onChange={(e) => setEdit({ ...edit, base_url: e.target.value })} placeholder="https://api.openai.com/v1" /></Field>
              <Field label="API key" className="sm:col-span-2" hint={edit.id ? (edit.has_key ? `Saved key: ${edit.key_preview}. Leave empty to keep it.` : 'No key saved.') : 'Stored encrypted on your server. Local models like Ollama need none.'}>
                <KeyInput value={edit.api_key} onChange={(v) => setEdit({ ...edit, api_key: v })} placeholder={edit.id && edit.has_key ? '•••••••• (unchanged)' : 'sk-…'} />
              </Field>
              <Field label="Priority" hint="1 = tried first."><Input type="number" min="1" value={edit.priority} onChange={(e) => setEdit({ ...edit, priority: e.target.value })} placeholder={edit.id ? '' : 'last'} /></Field>
              <Field label="Enabled"><div className="pt-1.5"><Toggle checked={edit.enabled} onChange={(v) => setEdit({ ...edit, enabled: v })} label="Enabled" /></div></Field>
            </div>
            {edit.id && edit.has_key && <button className="text-xs text-red-600 underline" onClick={() => setEdit({ ...edit, clear_key: true, has_key: false, api_key: '' })}>Remove saved key</button>}
            <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button loading={saving} onClick={save}>Save</Button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
