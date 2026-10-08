import { useState } from 'react';
import { api } from '../api.js';
import { Card, Button, Textarea, CopyButton, useToast, cx } from '../components/ui.jsx';
import { Markdown, ModelBadge, AIErrorBox, useAI } from '../components/AI.jsx';
import { fmtDate } from '../money.js';
import { StepShell, useWizard } from './Wizard.jsx';

const ICON = { ok: ['✓', 'bg-emerald-100 text-emerald-700'], warning: ['!', 'bg-amber-100 text-amber-800'], missing: ['✕', 'bg-red-100 text-red-700'] };

export default function Step6Finalize() {
  const { c, set, flush, merge } = useWizard();
  const ai = useAI();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const check = c.ai?.checklist;
  const run = async () => {
    await flush();
    const r = await ai.run(() => api.post('/ai/checklist', { contract_id: c.id }));
    if (r) set({ ai: { ...(c.ai || {}), checklist: r }, ...(r.final_summary ? { final_summary: r.final_summary } : {}) });
  };
  const blocking = (check?.items || []).filter((i) => i.status === 'missing').length;
  const submit = async () => {
    if (blocking && !confirm(`${blocking} item(s) are still marked missing. Submit anyway?`)) return;
    setBusy(true);
    try { merge(await flush({ status: 'submitted' })); toast('Contract marked as submitted 🎉'); } finally { setBusy(false); }
  };

  return (
    <StepShell title="Finalize & submit"
      intro="A last check before you sign or send: the AI looks for missing details, numbers that don't match, and unclear clauses, then writes a one-page summary of the deal."
      why={<>
        <p>Small mistakes (a wrong amount, a missing deadline, a forgotten risky clause) are cheap to fix now and expensive later.</p>
        <p>The final summary is your “single source of truth”. Keep it, and send it to the client to confirm you both understand the deal the same way.</p>
      </>}
      askSuggestions={['What should I do right after signing?', 'How do I send the signed contract back?', 'What if the client wants changes after I submit?']}>
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h3 className="font-semibold">Pre-submission checklist</h3>{check?.at && <p className="text-xs text-slate-500">Last run {fmtDate(check.at)}</p>}</div>
          <Button variant="ai" loading={ai.loading} onClick={run}>✦ {check ? 'Run again' : 'Run the checklist'}</Button>
        </div>
        <AIErrorBox error={ai.error} />
        {check?.ai_error && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">AI review unavailable ({check.ai_error}). Showing the automatic checks only.</p>}
        {check?.items && (
          <ul className="mt-4 space-y-2">
            {check.items.map((it, i) => {
              const [icon, cls] = ICON[it.status] || ICON.warning;
              return (
                <li key={i} className="flex gap-3 rounded-xl border border-slate-100 p-3">
                  <span className={cx('grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold', cls)}>{icon}</span>
                  <div className="text-sm"><p className="font-medium">{it.title}</p><p className="text-slate-600">{it.detail}</p></div>
                </li>
              );
            })}
          </ul>
        )}
        {check?.model && <ModelBadge result={check} />}
      </Card>

      {(c.final_summary || editing) && (
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-semibold">Final summary</h3>
            <div className="flex gap-2"><CopyButton text={c.final_summary || ''} /><Button size="sm" variant="secondary" onClick={() => setEditing((e) => !e)}>{editing ? 'Preview' : 'Edit'}</Button></div>
          </div>
          {editing ? <Textarea className="min-h-[320px] font-mono text-xs" value={c.final_summary} onChange={(e) => set({ final_summary: e.target.value })} /> : <Markdown>{c.final_summary}</Markdown>}
        </Card>
      )}

      <Card className={c.status === 'submitted' ? 'border-emerald-300 bg-emerald-50' : ''}>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!c.signed} onChange={(e) => set({ signed: e.target.checked })} />
          The contract has been signed by both sides
        </label>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">{c.status === 'submitted' ? `✓ Submitted ${fmtDate(c.submitted_at)}${c.signed ? ' and signed' : ''}. Nice work! Track payments on the dashboard.` : 'When everything looks right, mark it as submitted. It moves to “Submitted” on your dashboard.'}</p>
          {c.status !== 'submitted' && <Button variant="success" loading={busy} onClick={submit}>Mark as submitted</Button>}
        </div>
      </Card>
    </StepShell>
  );
}
