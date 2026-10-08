import { useRef, useState } from 'react';
import { api } from '../api.js';
import { Card, Button, Field, Input, Textarea, Tabs, Pill, useToast } from '../components/ui.jsx';
import { Markdown, ModelBadge, AIErrorBox, useAI } from '../components/AI.jsx';
import { Term } from '../components/Help.jsx';
import { StepShell, useWizard } from './Wizard.jsx';

const TERM_FIELDS = [
  { k: 'scope', label: <Term t="scope">Scope of work</Term>, ph: 'What exactly you will deliver (and what is not included)', ai: 'scope' },
  { k: 'payment_terms', label: <Term t="payment terms">Payment terms</Term>, ph: 'e.g. 50% upfront, 50% within 14 days of delivery', ai: 'payment_terms' },
  { k: 'deadlines', label: 'Deadlines', ph: 'e.g. First draft by 15 Nov, final by 30 Nov', ai: 'deadlines' },
  { k: 'penalties', label: <Term t="penalty">Penalties</Term>, ph: 'e.g. 5% off per week late (or "none")', ai: 'penalties' },
  { k: 'termination', label: <Term t="termination">Termination</Term>, ph: 'How either side can end the contract early', ai: 'termination' },
  { k: 'ip', label: <><Term t="ip">IP / ownership</Term></>, ph: 'Who owns the work, and when', ai: 'ip_ownership' },
];

export default function Step1Contract() {
  const { c, set, setIn, flush } = useWizard();
  const [mode, setMode] = useState(c.contract_text ? 'paste' : 'upload');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();
  const toast = useToast();
  const ai = useAI();
  const summary = c.ai?.summary;

  const onFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { text, chars } = await api.upload('/extract', file);
      set({ contract_text: text, ...(c.title === 'Untitled contract' ? { title: file.name.replace(/\.[^.]+$/, '').slice(0, 80) } : {}) });
      setMode('paste');
      toast(`Read ${chars.toLocaleString()} characters from ${file.name}`);
    } catch (e) { toast(e.message, 'error'); } finally { setUploading(false); fileRef.current.value = ''; }
  };

  const explain = async () => {
    await flush();
    const r = await ai.run(() => api.post('/ai/summarize', { contract_id: c.id }));
    if (!r) return;
    // Fill any empty manual fields from what the AI found.
    const terms = { ...(c.terms || {}) };
    let filled = 0;
    for (const f of TERM_FIELDS) {
      const v = r.key_terms?.[f.ai];
      if (v && !terms[f.k]) { terms[f.k] = v; filled++; }
    }
    const patch = { ai: { ...(c.ai || {}), summary: r }, terms };
    if (c.title === 'Untitled contract' && r.key_terms?.title) patch.title = r.key_terms.title.slice(0, 120);
    set(patch);
    if (filled) toast(`Filled ${filled} empty field${filled > 1 ? 's' : ''} from the contract. Check them below.`);
  };

  return (
    <StepShell title="Contract details"
      intro="Add the contract you were offered: upload it, paste it, or type the main terms yourself. The AI will explain it in plain English and point out anything risky."
      why={<>
        <p>A contract decides <b>what you must do, how much you get paid, and when</b>. Most freelancer problems (late payment, endless changes, unpaid cancelled work) come from terms nobody read closely.</p>
        <p>Understanding it <i>before</i> you agree is your biggest bargaining moment. Once it's signed, changes are much harder.</p>
      </>}
      askSuggestions={['What should I look for first in a contract?', 'Is it normal to ask for changes to a contract?', 'What does "work for hire" mean?']}>
      <Card>
        <Field label="Give this deal a name" hint="Just for you, e.g. “Acme website redesign”."><Input value={c.title} onChange={(e) => set({ title: e.target.value })} /></Field>
        <div className="mt-5">
          <Tabs value={mode} onChange={setMode} tabs={[{ id: 'upload', label: '⬆ Upload file' }, { id: 'paste', label: '📋 Paste text' }, { id: 'manual', label: '✎ Enter terms manually' }]} />
          {mode === 'upload' && (
            <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}
              className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-8 text-center">
              <p className="font-medium">Drop the contract here</p>
              <p className="mb-3 text-sm text-slate-500">PDF, Word (.docx) or text file, up to 15 MB</p>
              <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md,text/plain,application/pdf" className="hidden" onChange={(e) => onFile(e.target.files[0])} />
              <Button variant="secondary" loading={uploading} onClick={() => fileRef.current.click()}>Choose file</Button>
              {c.contract_text && <p className="mt-3 text-xs text-emerald-700">✓ Contract text loaded ({c.contract_text.length.toLocaleString()} characters). See “Paste text”.</p>}
            </div>
          )}
          {mode === 'paste' && <Textarea className="min-h-[260px] font-mono text-xs" value={c.contract_text} onChange={(e) => set({ contract_text: e.target.value })} placeholder="Paste the full contract or the client's email with the terms…" />}
          {mode === 'manual' && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">No document? Fill in the key terms below. Even an email offer can be turned into clear terms.</p>}
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h3 className="font-semibold">Key terms</h3><p className="text-sm text-slate-500">Hover or tap an underlined word for a quick explanation.</p></div>
          <Button variant="ai" loading={ai.loading} disabled={!c.contract_text && !Object.values(c.terms || {}).some(Boolean)} onClick={explain}>✦ {summary ? 'Re-check' : 'Explain & check'} this contract</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {TERM_FIELDS.map((f) => (
            <Field key={f.k} label={f.label}><Textarea className="!min-h-[70px]" value={c.terms?.[f.k] || ''} placeholder={f.ph} onChange={(e) => setIn('terms', f.k, e.target.value)} /></Field>
          ))}
        </div>
        <AIErrorBox error={ai.error} />
      </Card>

      {summary && (
        <Card className="border-violet-200">
          <h3 className="mb-2 font-semibold">✦ In plain English</h3>
          <Markdown>{summary.plain_summary}</Markdown>
          {summary.flags?.length > 0 && (
            <>
              <h4 className="mb-2 mt-5 font-semibold">Things to watch ({summary.flags.length})</h4>
              <ul className="space-y-3">
                {[...summary.flags].sort((a, b) => ['high', 'medium', 'low'].indexOf(a.severity) - ['high', 'medium', 'low'].indexOf(b.severity)).map((f, i) => (
                  <li key={i} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-start gap-2"><Pill value={f.severity}>{f.severity === 'high' ? 'High risk' : f.severity === 'medium' ? 'Check this' : 'Minor'}</Pill><p className="font-medium">{f.clause}</p></div>
                    <p className="mt-1.5 text-sm text-slate-700">{f.why_it_matters}</p>
                    {f.suggestion && <p className="mt-1.5 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-900"><b>Ask for:</b> {f.suggestion}</p>}
                  </li>
                ))}
              </ul>
            </>
          )}
          {summary.questions_to_ask?.length > 0 && (
            <>
              <h4 className="mb-2 mt-5 font-semibold">Questions to ask the client</h4>
              <ul className="list-disc space-y-1 pl-5 text-sm">{summary.questions_to_ask.map((q, i) => <li key={i}>{q}</li>)}</ul>
            </>
          )}
          <ModelBadge result={summary} />
        </Card>
      )}
    </StepShell>
  );
}
