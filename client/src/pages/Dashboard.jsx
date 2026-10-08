import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { Card, Pill, Empty, Button, Modal, Select, Input, Textarea, CopyButton, useToast } from '../components/ui.jsx';
import { ModelBadge, AIErrorBox, useAI } from '../components/AI.jsx';
import { NewContractButton } from '../components/NewContract.jsx';
import { money, fmtDate } from '../money.js';

const STAGES = [
  { id: 'draft', label: 'Draft', hint: 'Still filling in details' },
  { id: 'negotiating', label: 'Negotiating', hint: 'Talking price & terms' },
  { id: 'agreed', label: 'Agreed', hint: 'Terms settled' },
  { id: 'submitted', label: 'Submitted', hint: 'Signed or sent off' },
];

const sumLine = (obj) => Object.entries(obj || {}).map(([c, v]) => money(v, c)).join(' + ') || money(0);

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [reminder, setReminder] = useState(null);
  const nav = useNavigate();
  const toast = useToast();
  const load = () => api.get('/dashboard').then(setD).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  if (err) return <Card className="text-red-700">{err}</Card>;
  if (!d) return <p className="text-slate-500">Loading…</p>;

  const act = async (s) => {
    if (s.type === 'overdue' || s.type === 'due_soon' || s.type === 'stalled') return setReminder(s);
    if (s.type === 'recurring') {
      try { const inv = await api.post(`/invoices/${s.invoice_id}/next`); toast(`Created ${inv.number}`); nav(`/invoices/${inv.id}`); }
      catch (e) { toast(e.message, 'error'); }
      return;
    }
    nav(`/invoices/${s.invoice_id}`);
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Got a new job offer?</h1>
          <p className="mt-1 max-w-xl text-indigo-100">I'll walk you through it step by step: understand the contract, set a fair price, negotiate, invoice, and submit. No jargon without an explanation.</p>
        </div>
        <NewContractButton size="lg" className="!bg-white !text-indigo-700 hover:!bg-indigo-50" />
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Waiting to be paid" value={sumLine(d.outstanding)} hint="Sent invoices not yet paid" />
        <Stat label="Overdue" value={sumLine(d.overdue)} hint={`${d.invoiceStatus.overdue} invoice(s) past due`} tone={d.invoiceStatus.overdue ? 'red' : undefined} />
        <Stat label="Paid so far" value={sumLine(d.paid)} hint={`${d.invoiceStatus.paid} invoice(s)`} />
        <Stat label="Deals in negotiation" value={d.stages.negotiating.length} hint={`${d.counts.contracts} contract(s) total`} />
      </div>

      {d.suggestions.length > 0 && (
        <Card>
          <h2 className="mb-1 font-semibold">✦ Suggested next steps</h2>
          <p className="mb-4 text-sm text-slate-500">Things that need a nudge. The AI can write the message for you.</p>
          <ul className="divide-y divide-slate-100">
            {d.suggestions.map((s, i) => (
              <li key={i} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="font-medium">{s.title}</p><p className="text-sm text-slate-500">{s.detail}</p></div>
                <Button size="sm" variant={['overdue', 'due_soon', 'stalled'].includes(s.type) ? 'ai' : 'secondary'} onClick={() => act(s)}>
                  {s.type === 'overdue' || s.type === 'due_soon' ? '✦ Draft reminder' : s.type === 'stalled' ? '✦ Draft follow-up' : s.type === 'recurring' ? 'Create next invoice' : 'Open invoice'}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section>
        <h2 className="mb-3 font-semibold">Contracts by stage</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STAGES.map((s) => (
            <div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between"><Pill value={s.id}>{s.label}</Pill><span className="text-sm text-slate-400">{d.stages[s.id].length}</span></div>
              <p className="mb-2 text-xs text-slate-400">{s.hint}</p>
              <div className="space-y-2">
                {d.stages[s.id].slice(0, 6).map((c) => (
                  <Link key={c.id} to={`/contracts/${c.id}/step/${c.wizard_step}`} className="block rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-sm hover:border-indigo-200 hover:bg-indigo-50">
                    <p className="truncate font-medium">{c.title}</p>
                    <p className="truncate text-xs text-slate-500">{c.client_name || 'No client yet'} · step {c.wizard_step}/6{c.signed ? ' · signed' : ''}</p>
                  </Link>
                ))}
                {!d.stages[s.id].length && <p className="py-3 text-center text-xs text-slate-400">Nothing here</p>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Invoices</h2>
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            {['draft', 'sent', 'paid', 'overdue'].map((s) => (
              <Link key={s} to={`/invoices?status=${s}`} className="rounded-xl bg-slate-50 p-3 hover:bg-slate-100">
                <p className="text-2xl font-bold">{d.invoiceStatus[s]}</p><Pill value={s} />
              </Link>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Coming up (next 30 days)</h2>
          {d.deadlines.length ? (
            <ul className="space-y-2">
              {d.deadlines.map((x, i) => (
                <li key={i}>
                  <Link to={x.contract_id ? `/contracts/${x.contract_id}/step/3` : `/invoices/${x.invoice_id}`} className="flex items-center justify-between gap-3 rounded-lg p-1.5 text-sm hover:bg-slate-50">
                    <span className="min-w-0"><span className="block truncate font-medium">{x.title}</span><span className="text-xs text-slate-500">{x.kind}</span></span>
                    <span className="shrink-0 text-slate-600">{fmtDate(x.date)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-500">No deadlines in the next 30 days.</p>}
        </Card>
      </div>

      {!d.counts.contracts && <Empty title="No contracts yet">Tap “I have a new contract” to start. Before that, add an AI model in <Link className="text-indigo-600 underline" to="/settings/models">Settings → AI Models</Link>.</Empty>}

      <ReminderModal s={reminder} onClose={() => setReminder(null)} />
    </div>
  );
}

function Stat({ label, value, hint, tone }) {
  return (
    <Card className="!p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold sm:text-xl ${tone === 'red' ? 'text-red-600' : ''}`}>{value}</p>
      <p className="text-xs text-slate-400">{hint}</p>
    </Card>
  );
}

export function ReminderModal({ s, onClose }) {
  const [tone, setTone] = useState('friendly');
  const [out, setOut] = useState(null);
  const ai = useAI();
  useEffect(() => { setOut(null); ai.setError(null); if (s?.tone) setTone(s.tone); }, [s]); // eslint-disable-line
  if (!s) return null;
  const gen = async () => {
    const r = await ai.run(() => api.post('/ai/reminder', { invoice_id: s.invoice_id, contract_id: s.contract_id, tone }));
    if (r) setOut(r);
  };
  const mailto = out ? `mailto:${encodeURIComponent(out.to || '')}?subject=${encodeURIComponent(out.subject)}&body=${encodeURIComponent(out.body)}` : '';
  return (
    <Modal open={!!s} onClose={onClose} title={s.contract_id && !s.invoice_id ? 'Follow-up message' : 'Payment reminder'} wide>
      <p className="mb-3 text-sm text-slate-500">{s.title}. Pick a tone. Start friendly; most late payments are simply forgotten.</p>
      <div className="flex flex-wrap items-end gap-2">
        <Select value={tone} onChange={(e) => setTone(e.target.value)} className="!w-auto">
          <option value="friendly">Friendly nudge</option>
          <option value="firm">Firm</option>
          {!s.contract_id && <option value="final">Final notice</option>}
          {s.contract_id && <option value="formal">Formal</option>}
        </Select>
        <Button variant="ai" loading={ai.loading} onClick={gen}>✦ {out ? 'Rewrite' : 'Write it for me'}</Button>
      </div>
      <AIErrorBox error={ai.error} />
      {out && (
        <div className="mt-4 space-y-3">
          <Input value={out.subject} onChange={(e) => setOut({ ...out, subject: e.target.value })} />
          <Textarea className="min-h-[220px]" value={out.body} onChange={(e) => setOut({ ...out, body: e.target.value })} />
          <div className="flex flex-wrap gap-2">
            <CopyButton text={`Subject: ${out.subject}\n\n${out.body}`} />
            <a href={mailto}><Button variant="secondary" size="sm">Open in my email app</Button></a>
          </div>
          <ModelBadge result={out} />
        </div>
      )}
    </Modal>
  );
}
