import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { api } from '../api.js';
import { Button, Modal, Textarea, cx } from './ui.jsx';
import { Link } from 'react-router-dom';

export const Markdown = ({ children, className }) => <div className={cx('md text-sm text-slate-800', className)}><ReactMarkdown>{children || ''}</ReactMarkdown></div>;

/** Shows which model answered, and whether a fallback happened. */
export function ModelBadge({ result }) {
  if (!result?.model) return null;
  const failed = (result.attempts || []).filter((a) => !a.ok);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
      <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-violet-700">✦ Answered by {result.model.provider} · {result.model.model}</span>
      {failed.length > 0 && <span title={failed.map((a) => `${a.provider}/${a.model}: ${a.error}`).join('\n')}>after {failed.length} fallback{failed.length > 1 ? 's' : ''} ({failed.map((a) => `${a.provider}: ${a.label}`).join(', ')})</span>}
      <span>· Not legal advice</span>
    </div>
  );
}

/** Clear error box when every model failed (or none is set up). */
export function AIErrorBox({ error }) {
  if (!error) return null;
  return (
    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <p className="font-semibold">AI could not answer</p>
      <p className="mt-1">{error.message}</p>
      {error.attempts?.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs">
          {error.attempts.map((a, i) => (
            <li key={i}><b>{a.priority || i + 1}. {a.provider} · {a.model}</b>: {a.label}{a.error ? `: ${a.error}` : ''}</li>
          ))}
        </ul>
      )}
      <Link to="/settings/models" className="mt-2 inline-block font-medium underline">Open AI model settings →</Link>
    </div>
  );
}

/** Hook: run an AI call with loading + error state. */
export function useAI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const run = async (fn) => {
    setLoading(true); setError(null);
    try { return await fn(); }
    catch (e) { setError(e); return null; }
    finally { setLoading(false); }
  };
  return { loading, error, run, setError };
}

/** "Ask AI" button + dialog, available on every step. */
export function AskAI({ step, contractId, suggestions = [] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const ai = useAI();
  const ask = async (question) => {
    const text = question ?? q;
    if (!text.trim()) return;
    setQ(text);
    const out = await ai.run(() => api.post('/ai/ask', { contract_id: contractId, step, question: text }));
    if (out) setRes(out);
  };
  return (
    <>
      <Button variant="ai" size="sm" onClick={() => setOpen(true)}>✦ Ask AI</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Ask AI about this step" wide>
        <p className="mb-3 text-sm text-slate-500">Ask anything, in your own words. No question is too basic.</p>
        {suggestions.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {suggestions.map((s) => <button key={s} onClick={() => ask(s)} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100">{s}</button>)}
          </div>
        )}
        <Textarea value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. What is a reasonable deposit to ask for?" onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) ask(); }} />
        <div className="mt-3 flex justify-end"><Button variant="ai" loading={ai.loading} onClick={() => ask()}>Ask</Button></div>
        <AIErrorBox error={ai.error} />
        {res && !ai.loading && (
          <div className="mt-4 rounded-xl bg-slate-50 p-4">
            <Markdown>{res.answer}</Markdown>
            <ModelBadge result={res} />
          </div>
        )}
      </Modal>
    </>
  );
}
