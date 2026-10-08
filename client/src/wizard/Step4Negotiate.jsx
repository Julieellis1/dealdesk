import { useState } from 'react';
import { api } from '../api.js';
import { Card, Field, Input, Textarea, Select, Button, Tabs, CopyButton, Pill, useToast, cx } from '../components/ui.jsx';
import { Markdown, ModelBadge, AIErrorBox, useAI } from '../components/AI.jsx';
import { Term } from '../components/Help.jsx';
import { money, fmtDate, todayStr, CURRENCIES } from '../money.js';
import { StepShell, useWizard } from './Wizard.jsx';
import { jobTotal } from './Step3Job.jsx';

const SCENARIOS = [
  'Propose my price for the first time',
  'Counter their offer with a higher price',
  'Ask for a deposit before starting',
  'Push back on a risky clause in the contract',
  'Ask to limit revisions / scope',
  'Accept the deal and confirm the terms in writing',
  'Politely decline the job',
];

export default function Step4Negotiate() {
  const [tab, setTab] = useState('advice');
  return (
    <StepShell title="Pricing & negotiation coach"
      intro="Get a fair price range, ready-to-send emails, practise the conversation, and log every offer until you agree."
      why={<>
        <p>Most clients <b>expect</b> some negotiation. Their first offer is rarely their best. Asking politely for more, or for better payment terms, is normal and professional.</p>
        <p>The payment <i>structure</i> matters as much as the price: a <Term t="deposit">deposit</Term> and short <Term t="net terms">net terms</Term> protect you from doing work you never get paid for.</p>
      </>}
      askSuggestions={['How do I say my price without sounding nervous?', 'What if they say they have no budget?', 'Is 50% deposit too much to ask?']}>
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'advice', label: '💰 Price advice' }, { id: 'scripts', label: '✉️ Email scripts' }, { id: 'practice', label: '🎭 Practice' },
        { id: 'timeline', label: '🕑 Negotiation log' }, { id: 'agreed', label: '🤝 Agreed terms' },
      ]} />
      {tab === 'advice' && <Advice onUse={() => setTab('agreed')} />}
      {tab === 'scripts' && <Scripts />}
      {tab === 'practice' && <Practice />}
      {tab === 'timeline' && <Timeline />}
      {tab === 'agreed' && <Agreed />}
    </StepShell>
  );
}

function Advice({ onUse }) {
  const { c, set, setIn, flush } = useWizard();
  const ctx = c.pricing?.context || {};
  const setCtx = (k) => (e) => setIn('pricing', 'context', { ...ctx, [k]: e.target.value });
  const ai = useAI();
  const p = c.ai?.pricing;
  const toast = useToast();
  const run = async () => {
    await flush();
    const r = await ai.run(() => api.post('/ai/pricing', { contract_id: c.id, context: ctx }));
    if (r) set({ ai: { ...(c.ai || {}), pricing: r } });
  };
  const use = () => {
    const ps = p.payment_structure || {};
    set({ pricing: { ...(c.pricing || {}), agreed_currency: c.pricing?.agreed_currency || p.currency, deposit_percent: ps.deposit_percent ?? c.pricing?.deposit_percent, net_days: ps.net_days ?? c.pricing?.net_days, payment_structure: ps.recommended || c.pricing?.payment_structure, target_amount: p.fair } });
    toast('Payment structure copied to “Agreed terms”. Adjust it once you and the client agree.');
    onUse();
  };
  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-semibold">Tell the coach about you</h3>
        <p className="mb-4 text-sm text-slate-500">This helps it suggest prices that fit your market. Rough answers are fine.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Your experience"><Select value={ctx.experience || ''} onChange={setCtx('experience')}>
            <option value="">Choose…</option><option>Just starting (under 1 year)</option><option>Some experience (1-3 years)</option><option>Experienced (3-7 years)</option><option>Expert (7+ years)</option>
          </Select></Field>
          <Field label="Where you and the client are" hint="Prices differ a lot by country and industry."><Input value={ctx.market || ''} onChange={setCtx('market')} placeholder="e.g. I'm in Lagos, client is a UK startup" /></Field>
          <Field label="Client's budget or first offer (if known)"><Input value={ctx.client_offer || ''} onChange={setCtx('client_offer')} placeholder="e.g. They offered $1,500" /></Field>
          <Field label={<>Your <Term t="walk-away point">walk-away point</Term></>} hint="The lowest you'd accept. Kept private."><Input value={ctx.walk_away || ''} onChange={setCtx('walk_away')} placeholder="e.g. $1,800" /></Field>
          <Field label="Anything else?" className="sm:col-span-2"><Input value={ctx.notes || ''} onChange={setCtx('notes')} placeholder="e.g. tight deadline, they want ongoing work later, I really want this client" /></Field>
        </div>
        <div className="mt-4 flex justify-end"><Button variant="ai" loading={ai.loading} onClick={run}>✦ {p ? 'Refresh' : 'Get'} price advice</Button></div>
        <AIErrorBox error={ai.error} />
      </Card>

      {p && (
        <Card className="border-violet-200">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[['Low', p.low, 'bg-slate-50'], ['Fair', p.fair, 'bg-indigo-600 text-white'], ['High', p.high, 'bg-slate-50']].map(([l, v, cls]) => (
              <div key={l} className={cx('rounded-xl p-3', cls)}>
                <p className="text-xs uppercase tracking-wide opacity-75">{l}</p>
                <p className="text-lg font-bold sm:text-xl">{money(v, p.currency || 'USD')}</p>
                <p className="text-xs opacity-75">{p.price_basis}</p>
              </div>
            ))}
          </div>
          <div className="mt-4"><Markdown>{p.rationale}</Markdown></div>
          {p.payment_structure && (
            <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-950">
              <p className="font-semibold">Suggested payment structure: {p.payment_structure.recommended}</p>
              <p className="mt-1">{p.payment_structure.explanation}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {p.payment_structure.deposit_percent > 0 && <Pill value="paid">{p.payment_structure.deposit_percent}% deposit</Pill>}
                {p.payment_structure.net_days != null && <Pill value="sent">Net {p.payment_structure.net_days}</Pill>}
                {(p.payment_structure.milestones || []).map((m, i) => <Pill key={i}>{m.name}: {m.percent}%</Pill>)}
              </div>
              <Button size="sm" className="mt-3" onClick={use}>Use this structure</Button>
            </div>
          )}
          {p.strategies?.length > 0 && (
            <>
              <h4 className="mb-2 mt-5 font-semibold">Negotiation strategies</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {p.strategies.map((s, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 p-3 text-sm">
                    <p className="font-semibold">{s.name}</p><p className="mt-1 text-slate-700">{s.how}</p>
                    {s.example && <p className="mt-2 rounded-lg bg-slate-50 p-2 italic text-slate-600">“{s.example}”</p>}
                  </div>
                ))}
              </div>
            </>
          )}
          <ModelBadge result={p} />
        </Card>
      )}
    </div>
  );
}

function Scripts() {
  const { c, set, flush } = useWizard();
  const saved = c.ai?.scripts;
  const [scenario, setScenario] = useState(saved?.scenario || SCENARIOS[0]);
  const [notes, setNotes] = useState('');
  const [tone, setTone] = useState('friendly');
  const ai = useAI();
  const run = async () => {
    await flush();
    const r = await ai.run(() => api.post('/ai/scripts', { contract_id: c.id, scenario, notes }));
    if (r) set({ ai: { ...(c.ai || {}), scripts: r } });
  };
  const email = saved?.emails?.find((e) => e.tone === tone) || saved?.emails?.[0];
  const mailto = email ? `mailto:${encodeURIComponent(c.client?.email || '')}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}` : '';
  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="What do you want to say?"><Select value={scenario} onChange={(e) => setScenario(e.target.value)}>{SCENARIOS.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="Details to include (optional)"><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. my price is $2,400; I can start Monday" /></Field>
        </div>
        <div className="mt-4 flex justify-end"><Button variant="ai" loading={ai.loading} onClick={run}>✦ Write the emails</Button></div>
        <AIErrorBox error={ai.error} />
      </Card>
      {email && (
        <Card className="border-violet-200">
          <p className="mb-2 text-xs text-slate-500">For: {saved.scenario}</p>
          <Tabs value={tone} onChange={setTone} tabs={[{ id: 'friendly', label: '😊 Friendly' }, { id: 'firm', label: '💪 Firm' }, { id: 'formal', label: '🎩 Formal' }]} />
          <p className="text-sm"><span className="text-slate-500">Subject:</span> <b>{email.subject}</b></p>
          <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 font-sans text-sm leading-relaxed">{email.body}</pre>
          <div className="mt-3 flex flex-wrap gap-2">
            <CopyButton text={`Subject: ${email.subject}\n\n${email.body}`} label="Copy email" />
            <a href={mailto}><Button variant="secondary" size="sm">Open in my email app</Button></a>
          </div>
          {saved.tips?.length > 0 && <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-600">{saved.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>}
          <ModelBadge result={saved} />
        </Card>
      )}
    </div>
  );
}

function Practice() {
  const { c, set, flush } = useWizard();
  const obj = c.ai?.objections;
  const ai = useAI();
  const chatAI = useAI();
  const [history, setHistory] = useState([]);
  const [msg, setMsg] = useState('');
  const [lastMeta, setLastMeta] = useState(null);
  const loadObjections = async () => {
    await flush();
    const r = await ai.run(() => api.post('/ai/objections', { contract_id: c.id }));
    if (r) set({ ai: { ...(c.ai || {}), objections: r } });
  };
  const send = async () => {
    if (!msg.trim()) return;
    const h = [...history, { role: 'me', text: msg }];
    setHistory(h); setMsg('');
    const r = await chatAI.run(() => api.post('/ai/roleplay', { contract_id: c.id, history: h }));
    if (r) { setHistory([...h, { role: 'client', text: r.client_reply, tip: r.coach_tip }]); setLastMeta(r); }
  };
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h3 className="font-semibold">What will the client push back on?</h3><p className="text-sm text-slate-500">The likely objections, and exactly what to say back.</p></div>
          <Button variant="ai" loading={ai.loading} onClick={loadObjections}>✦ {obj ? 'Refresh' : 'Show'} objections</Button>
        </div>
        <AIErrorBox error={ai.error} />
        {obj?.objections && (
          <div className="mt-4 space-y-3">
            {obj.objections.map((o, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-3 text-sm">
                <p className="font-medium text-slate-900">🧑‍💼 “{o.objection}”</p>
                <p className="mt-2 rounded-lg bg-indigo-50 p-2 text-indigo-950">🙋 You: “{o.response}”</p>
                <p className="mt-1.5 text-xs text-slate-500">Why it works: {o.why_it_works}</p>
              </div>
            ))}
            <ModelBadge result={obj} />
          </div>
        )}
      </Card>
      <Card>
        <h3 className="font-semibold">Practice the conversation</h3>
        <p className="mb-3 text-sm text-slate-500">The AI plays your client. Type what you'd say. After each reply you get a coaching tip. Nothing here is sent to anyone.</p>
        <div className="mb-3 max-h-96 space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-3">
          {!history.length && <p className="text-center text-sm text-slate-400">Start by stating your price, e.g. “Thanks for the brief! For this scope my fee is $2,400.”</p>}
          {history.map((m, i) => (
            <div key={i} className={cx('flex', m.role === 'me' ? 'justify-end' : 'justify-start')}>
              <div className={cx('max-w-[85%] rounded-2xl px-3 py-2 text-sm', m.role === 'me' ? 'bg-indigo-600 text-white' : 'bg-white shadow-sm')}>
                {m.text}
                {m.tip && <p className="mt-2 border-t border-slate-100 pt-1.5 text-xs text-emerald-700">💡 Coach: {m.tip}</p>}
              </div>
            </div>
          ))}
          {chatAI.loading && <p className="text-xs text-slate-400">Client is typing…</p>}
        </div>
        <div className="flex gap-2">
          <Input value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Your reply…" />
          <Button onClick={send} loading={chatAI.loading}>Send</Button>
          {history.length > 0 && <Button variant="ghost" onClick={() => setHistory([])}>Reset</Button>}
        </div>
        <AIErrorBox error={chatAI.error} />
        {lastMeta && <ModelBadge result={lastMeta} />}
      </Card>
    </div>
  );
}

const KIND = { offer: 'Offer', counter: 'Counter-offer', accepted: 'Accepted', rejected: 'Rejected', note: 'Note' };

function Timeline() {
  const { c, merge } = useWizard();
  const cur = c.pricing?.agreed_currency || c.job?.currency || 'USD';
  const [f, setF] = useState({ party: 'client', kind: 'offer', amount: '', notes: '', round_date: todayStr() });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const add = async () => {
    setBusy(true);
    try { merge(await api.post(`/contracts/${c.id}/rounds`, f)); setF({ ...f, amount: '', notes: '' }); toast('Added to the log'); }
    catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  const del = async (r) => { merge(await api.del(`/rounds/${r.id}`)); };
  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-semibold">Log a round</h3>
        <p className="mb-3 text-sm text-slate-500">Write down every offer and <Term t="counter-offer">counter-offer</Term>. It keeps you consistent and gives the AI context.</p>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Who"><Select value={f.party} onChange={(e) => setF({ ...f, party: e.target.value })}><option value="client">Client</option><option value="me">Me</option></Select></Field>
          <Field label="What"><Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label={`Amount (${cur})`}><Input type="number" step="any" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
          <Field label="Date"><Input type="date" value={f.round_date} onChange={(e) => setF({ ...f, round_date: e.target.value })} /></Field>
          <Field label="Notes" className="sm:col-span-4"><Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="e.g. They want delivery 1 week earlier; asked to drop deposit to 30%" /></Field>
        </div>
        <div className="mt-3 flex justify-end"><Button loading={busy} onClick={add}>Add to log</Button></div>
      </Card>
      <Card>
        {!c.rounds?.length ? <p className="text-center text-sm text-slate-400">No rounds yet.</p> : (
          <ol className="relative space-y-4 border-l-2 border-slate-200 pl-5">
            {c.rounds.map((r) => (
              <li key={r.id} className="relative">
                <span className={cx('absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-white', r.party === 'me' ? 'bg-indigo-600' : 'bg-amber-500')} />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm"><b>{r.party === 'me' ? 'You' : c.client?.name || 'Client'}</b> · {KIND[r.kind]}{r.amount != null && <> · <b>{money(r.amount, cur)}</b></>}</p>
                    <p className="text-xs text-slate-500">{fmtDate(r.round_date)}</p>
                    {r.notes && <p className="mt-1 text-sm text-slate-700">{r.notes}</p>}
                  </div>
                  <button onClick={() => del(r)} className="text-xs text-slate-400 hover:text-red-600">✕</button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

function Agreed() {
  const { c, setIn, flush, merge } = useWizard();
  const p = c.pricing || {};
  const s = (k) => (e) => setIn('pricing', k, e.target.value);
  const cur = p.agreed_currency || c.job?.currency || 'USD';
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const agree = async () => {
    if (!Number(p.agreed_amount)) return toast('Enter the agreed amount first.', 'error');
    setBusy(true);
    try {
      await flush();
      await api.post(`/contracts/${c.id}/rounds`, { party: 'client', kind: 'accepted', amount: p.agreed_amount, notes: p.payment_structure || '' });
      merge(await flush(c.status === 'submitted' ? { wizard_step: 4 } : { status: 'agreed' }));
      toast('Deal agreed 🎉 Next: create the invoices.');
    } finally { setBusy(false); }
  };
  return (
    <Card>
      <h3 className="font-semibold">What you agreed</h3>
      <p className="mb-4 text-sm text-slate-500">These numbers feed your invoices in step 5. Job value from step 3: <b>{money(jobTotal(c.job), c.job?.currency || 'USD')}</b>{p.target_amount ? <> · AI fair price: <b>{money(p.target_amount, cur)}</b></> : null}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Agreed total"><Input type="number" step="any" value={p.agreed_amount || ''} onChange={s('agreed_amount')} /></Field>
        <Field label="Currency"><Select value={cur} onChange={s('agreed_currency')}>{[...new Set([cur, ...CURRENCIES])].map((x) => <option key={x}>{x}</option>)}</Select></Field>
        <Field label="Payment structure" hint="In words, e.g. 50% upfront, 50% on delivery"><Input value={p.payment_structure || ''} onChange={s('payment_structure')} /></Field>
        <Field label={<><Term t="deposit">Deposit</Term> %</>} hint="0 if none"><Input type="number" min="0" max="100" value={p.deposit_percent ?? ''} onChange={s('deposit_percent')} /></Field>
        <Field label={<><Term t="net terms">Net terms</Term> (days)</>} hint="Days the client has to pay each invoice"><Input type="number" min="0" value={p.net_days ?? ''} onChange={s('net_days')} /></Field>
        <Field label={<><Term t="late fee">Late fee</Term> (optional)</>}><Input value={p.late_fee || ''} onChange={s('late_fee')} placeholder="e.g. 1.5% per month" /></Field>
        <Field label={<><Term t="retainer">Recurring</Term> amount (optional)</>} hint="Only for ongoing monthly/weekly work"><Input type="number" step="any" value={p.recurring_amount || ''} onChange={s('recurring_amount')} /></Field>
      </div>
      <div className="mt-5 flex flex-col items-start gap-3 rounded-xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">{c.status === 'agreed' || c.status === 'submitted' ? '✓ Marked as agreed. You can still edit the numbers.' : 'When the client says yes, mark it agreed. Then confirm it in writing (try the “Accept the deal” email script).'}</p>
        <Button variant="success" loading={busy} onClick={agree}>🤝 We have a deal</Button>
      </div>
    </Card>
  );
}
