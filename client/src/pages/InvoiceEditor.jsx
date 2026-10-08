import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { Card, Button, Field, Input, Textarea, Select, Pill, Modal, CopyButton, useToast } from '../components/ui.jsx';
import { Term } from '../components/Help.jsx';
import { ReminderModal } from './Dashboard.jsx';
import { totals, money, CURRENCIES, fmtDate } from '../money.js';

const TYPES = { single: 'Single (full amount)', deposit: 'Deposit', milestone: 'Milestone', recurring: 'Recurring' };

export default function InvoiceEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const back = params.get('back');
  const nav = useNavigate();
  const toast = useToast();
  const [inv, setInv] = useState(null);
  const [clients, setClients] = useState([]);
  const [meta, setMeta] = useState({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [share, setShare] = useState(null);
  const [reminder, setReminder] = useState(null);

  useEffect(() => {
    api.get(`/invoices/${id}`).then(setInv).catch((e) => toast(e.message, 'error'));
    api.get('/clients').then(setClients);
    api.get('/meta').then(setMeta);
  }, [id]); // eslint-disable-line

  if (!inv) return <p className="text-slate-500">Loading…</p>;
  const t = totals(inv);
  const set = (patch) => { setInv({ ...inv, ...patch }); setDirty(true); };
  const setItem = (i, k, v) => set({ items: inv.items.map((it, j) => (j === i ? { ...it, [k]: v } : it)) });

  const save = async (extra = {}) => {
    setSaving(true);
    try {
      const out = await api.put(`/invoices/${id}`, { ...inv, ...extra });
      setInv(out); setDirty(false); return out;
    } catch (e) { toast(e.message, 'error'); return null; } finally { setSaving(false); }
  };
  const status = async (s) => { const out = await save({ status: s }); if (out) toast(s === 'paid' ? 'Marked as paid 🎉' : `Marked as ${s}`); };
  const pdf = async () => { if (dirty) await save(); window.open(`/api/invoices/${id}/pdf`, '_blank'); };
  const makeShare = async () => { if (dirty) await save(); const s = await api.post(`/invoices/${id}/share`); setShare({ ...s, full: s.url || `${window.location.origin}${s.path}` }); };
  const del = async () => { if (confirm(`Delete invoice ${inv.number}?`)) { await api.del(`/invoices/${id}`); nav(back || '/invoices'); } };
  const nextRecurring = async () => { const n = await api.post(`/invoices/${id}/next`); toast(`Created ${n.number}`); nav(`/invoices/${n.id}`); };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link to={back || '/invoices'} className="text-sm text-indigo-600">← {back ? 'Back to the wizard' : 'All invoices'}</Link>
          <div className="mt-1 flex items-center gap-2"><h1 className="text-2xl font-bold">{inv.number}</h1><Pill value={inv.display_status} /></div>
          {inv.contract && <p className="text-sm text-slate-500">For <Link className="underline" to={`/contracts/${inv.contract.id}/step/5`}>{inv.contract.title}</Link></p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={pdf}>Download PDF</Button>
          <Button variant="secondary" onClick={() => setEmailOpen(true)}>Email</Button>
          <Button variant="secondary" onClick={makeShare}>Share link</Button>
          {inv.status === 'draft' && <Button variant="secondary" onClick={() => status('sent')}>Mark as sent</Button>}
          {inv.status === 'sent' && <Button variant="ai" onClick={() => setReminder({ invoice_id: inv.id, title: `${inv.number}${inv.days_overdue ? ` is ${inv.days_overdue} days overdue` : ` is due ${fmtDate(inv.due_date)}`}`, tone: inv.days_overdue > 21 ? 'final' : inv.days_overdue > 7 ? 'firm' : 'friendly' })}>✦ Draft reminder</Button>}
          {inv.status !== 'paid' ? <Button variant="success" onClick={() => status('paid')}>Mark as paid</Button> : <Button variant="secondary" onClick={() => status('sent')}>Undo paid</Button>}
        </div>
      </div>

      <Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Invoice number"><Input value={inv.number} onChange={(e) => set({ number: e.target.value })} /></Field>
          <Field label="Type"><Select value={inv.type} onChange={(e) => set({ type: e.target.value })}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Client"><Select value={inv.client_id || ''} onChange={(e) => set({ client_id: e.target.value ? Number(e.target.value) : null })}><option value="">—</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.company ? `${c.company} (${c.name})` : c.name}</option>)}</Select></Field>
          <Field label="Issue date"><Input type="date" value={inv.issue_date} onChange={(e) => set({ issue_date: e.target.value })} /></Field>
          <Field label={<Term t="due date">Due date</Term>}><Input type="date" value={inv.due_date} onChange={(e) => set({ due_date: e.target.value })} /></Field>
          <Field label="Currency"><Select value={inv.currency} onChange={(e) => set({ currency: e.target.value })}>{[...new Set([inv.currency, ...CURRENCIES])].map((c) => <option key={c}>{c}</option>)}</Select></Field>
        </div>
        {inv.type === 'recurring' && (
          <div className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-3">
            <Field label={<Term t="recurring invoice">Repeats</Term>}><Select value={inv.recurrence?.interval || 'monthly'} onChange={(e) => set({ recurrence: { ...inv.recurrence, interval: e.target.value } })}><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option></Select></Field>
            <Field label="Next invoice date" hint="You'll get a reminder on the dashboard."><Input type="date" value={inv.recurrence?.next_date || ''} onChange={(e) => set({ recurrence: { ...inv.recurrence, next_date: e.target.value } })} /></Field>
            <div className="flex items-end"><Button variant="secondary" onClick={nextRecurring}>Create next invoice now</Button></div>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Line items</h2>
        <div className="space-y-2">
          <div className="hidden grid-cols-12 gap-2 text-xs font-medium uppercase text-slate-500 sm:grid"><span className="col-span-6">Description</span><span className="col-span-2 text-right">Qty</span><span className="col-span-2 text-right">Unit price</span><span className="col-span-2 text-right">Amount</span></div>
          {inv.items.map((it, i) => (
            <div key={i} className="grid grid-cols-12 items-center gap-2 rounded-xl border border-slate-100 p-2 sm:border-0 sm:p-0">
              <Input className="col-span-12 sm:col-span-6" value={it.description} onChange={(e) => setItem(i, 'description', e.target.value)} placeholder="What you did" />
              <Input className="col-span-3 text-right sm:col-span-2" type="number" step="any" value={it.quantity} onChange={(e) => setItem(i, 'quantity', e.target.value)} />
              <Input className="col-span-4 text-right sm:col-span-2" type="number" step="any" value={it.unit_price} onChange={(e) => setItem(i, 'unit_price', e.target.value)} />
              <span className="col-span-4 text-right text-sm font-medium sm:col-span-1">{money((Number(it.quantity) || 0) * (Number(it.unit_price) || 0), inv.currency)}</span>
              <button className="col-span-1 text-slate-400 hover:text-red-600" onClick={() => set({ items: inv.items.filter((_, j) => j !== i) })} aria-label="Remove line">✕</button>
            </div>
          ))}
          <Button size="sm" variant="secondary" onClick={() => set({ items: [...inv.items, { description: '', quantity: 1, unit_price: 0 }] })}>＋ Add line</Button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Discount (amount)"><Input type="number" min="0" step="any" value={inv.discount} onChange={(e) => set({ discount: e.target.value })} /></Field>
            <Field label={<>Tax / <Term t="vat">VAT</Term> %</>}><Input type="number" min="0" step="any" value={inv.tax_rate} onChange={(e) => set({ tax_rate: e.target.value })} /></Field>
          </div>
          <div className="space-y-1 rounded-xl bg-slate-50 p-4 text-sm">
            <Row k="Subtotal" v={money(t.subtotal, inv.currency)} />
            {t.discount > 0 && <Row k="Discount" v={`− ${money(t.discount, inv.currency)}`} />}
            {Number(inv.tax_rate) > 0 && <Row k={`Tax (${inv.tax_rate}%)`} v={money(t.tax, inv.currency)} />}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold"><span>Total</span><span>{money(t.total, inv.currency)}</span></div>
          </div>
        </div>
      </Card>

      <Card className="grid gap-3 sm:grid-cols-2">
        <Field label="Payment instructions" hint="Bank details, PayPal, etc. Defaults come from Settings."><Textarea value={inv.payment_instructions} onChange={(e) => set({ payment_instructions: e.target.value })} /></Field>
        <Field label="Notes to client" hint="e.g. thank-you note, late fee terms."><Textarea value={inv.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
      </Card>

      <div className="sticky bottom-16 z-20 flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur md:bottom-4">
        <Button variant="danger" size="sm" onClick={del}>Delete</Button>
        <div className="flex items-center gap-3"><span className="text-sm text-slate-500">{dirty ? 'Unsaved changes' : 'All changes saved'}</span><Button loading={saving} disabled={!dirty} onClick={() => save().then((o) => o && toast('Saved'))}>Save</Button></div>
      </div>

      <EmailModal open={emailOpen} onClose={() => setEmailOpen(false)} inv={inv} meta={meta} onSent={(o) => { setInv(o); toast('Invoice emailed ✓'); }} beforeSend={() => dirty && save()} />
      <Modal open={!!share} onClose={() => setShare(null)} title="Share link">
        {share && <>
          <p className="mb-2 text-sm text-slate-500">Anyone with this link can view and download this invoice (read-only).{!share.url && ' It works for your client only if this app is reachable from the internet (set PUBLIC_URL in .env once deployed).'}</p>
          <div className="flex gap-2"><Input readOnly value={share.full} onFocus={(e) => e.target.select()} /><CopyButton text={share.full} /></div>
          <button className="mt-3 text-xs text-red-600 underline" onClick={async () => { await api.del(`/invoices/${id}/share`); setShare(null); toast('Link turned off'); }}>Turn off this link</button>
        </>}
      </Modal>
      <ReminderModal s={reminder} onClose={() => setReminder(null)} />
    </div>
  );
}

const Row = ({ k, v }) => <div className="flex justify-between"><span className="text-slate-500">{k}</span><span>{v}</span></div>;

function EmailModal({ open, onClose, inv, meta, onSent, beforeSend }) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!open) return;
    const t = totals(inv);
    setTo(inv.client?.email || '');
    setSubject(`Invoice ${inv.number}${inv.contract?.title ? ` · ${inv.contract.title}` : ''}`);
    setMessage(`Hi ${inv.client?.name?.split(' ')[0] || 'there'},\n\nPlease find attached invoice ${inv.number} for ${money(t.total, inv.currency)}, due on ${fmtDate(inv.due_date)}.\n\nPayment details are on the invoice. Let me know if you have any questions.\n\nThank you!`);
    setErr('');
  }, [open]); // eslint-disable-line
  const send = async () => {
    setBusy(true); setErr('');
    try { await beforeSend(); onSent(await api.post(`/invoices/${inv.id}/email`, { to, subject, message })); onClose(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
  return (
    <Modal open={open} onClose={onClose} title="Email this invoice" wide>
      <div className="space-y-3">
        <Field label="To"><Input type="email" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label="Subject"><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
        <Field label="Message"><Textarea className="min-h-[160px]" value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
        {!meta.mailConfigured && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Sending from the app isn't set up yet (needs SMTP details in <code>.env</code>). You can open your own email app instead. Download the PDF first and attach it.</p>}
        {err && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <a href={mailto}><Button variant="secondary">Open in my email app</Button></a>
          <Button loading={busy} disabled={!meta.mailConfigured} onClick={send}>Send with PDF attached</Button>
        </div>
      </div>
    </Modal>
  );
}
