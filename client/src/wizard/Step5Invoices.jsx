import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Card, Button, Select, Pill, Empty, useToast } from '../components/ui.jsx';
import { Term } from '../components/Help.jsx';
import { money, fmtDate } from '../money.js';
import { StepShell, useWizard } from './Wizard.jsx';
import { jobTotal } from './Step3Job.jsx';

export default function Step5Invoices() {
  const { c, flush, reload } = useWizard();
  const [busy, setBusy] = useState('');
  const [milestone, setMilestone] = useState('0');
  const [interval, setRecurInterval] = useState('monthly');
  const toast = useToast();
  const p = c.pricing || {};
  const cur = p.agreed_currency || c.job?.currency || 'USD';
  const agreed = Number(p.agreed_amount) || jobTotal(c.job);
  const milestones = c.job?.milestones || [];

  const gen = async (type) => {
    setBusy(type);
    try {
      await flush();
      const inv = await api.post(`/contracts/${c.id}/invoices/generate`, { type, milestone_index: Number(milestone), interval });
      toast(`${inv.number} created as a draft`);
      await reload();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(''); }
  };
  const back = encodeURIComponent(`/contracts/${c.id}/step/5`);

  return (
    <StepShell title="Invoices"
      intro={<>Turn the agreed terms into professional invoices. Each one opens in an editor where you can change anything, then download a PDF, email it, or share a link.</>}
      why={<>
        <p>An invoice is your official request for payment. A clear one (correct client details, invoice number, <Term t="due date">due date</Term> and how to pay) gets paid faster.</p>
        <p>If you agreed a <Term t="deposit">deposit</Term>, send that invoice <b>before</b> you start work.</p>
      </>}
      askSuggestions={['What must an invoice include?', 'Should I charge VAT or tax?', 'When should I send the final invoice?']}>
      <Card>
        <p className="mb-4 text-sm text-slate-600">Agreed total: <b>{money(agreed, cur)}</b>{Number(p.deposit_percent) ? ` · ${p.deposit_percent}% deposit` : ''}{p.net_days !== undefined && p.net_days !== '' ? ` · Net ${p.net_days}` : ''}. <Link className="text-indigo-600 underline" to={`/contracts/${c.id}/step/4`}>Edit in step 4</Link></p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <GenCard title="Single invoice" desc="The full amount (minus any deposit already invoiced), plus billable expenses." onClick={() => gen('single')} busy={busy === 'single'} />
          <GenCard title="Deposit invoice" desc={Number(p.deposit_percent) ? `${p.deposit_percent}% upfront: ${money(agreed * p.deposit_percent / 100, cur)}` : 'Set a deposit % in step 4 first.'} onClick={() => gen('deposit')} busy={busy === 'deposit'} disabled={!Number(p.deposit_percent)} />
          <GenCard title="Milestone invoice" desc={milestones.length ? 'Bill one milestone from step 3.' : 'Add milestones in step 3 first.'} onClick={() => gen('milestone')} busy={busy === 'milestone'} disabled={!milestones.length}>
            {milestones.length > 0 && <Select className="mb-2" value={milestone} onChange={(e) => setMilestone(e.target.value)}>{milestones.map((m, i) => <option key={i} value={i}>{m.name || `Milestone ${i + 1}`}</option>)}</Select>}
          </GenCard>
          <GenCard title="Recurring invoice" desc={<>For ongoing work, like a <Term t="retainer">retainer</Term>.</>} onClick={() => gen('recurring')} busy={busy === 'recurring'}>
            <Select className="mb-2" value={interval} onChange={(e) => setRecurInterval(e.target.value)}><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option></Select>
          </GenCard>
        </div>
      </Card>

      <div>
        <h3 className="mb-3 font-semibold">Invoices for this contract</h3>
        {!c.invoices?.length ? <Empty title="No invoices yet">Pick a type above to create your first draft.</Empty> : (
          <div className="space-y-2">
            {c.invoices.map((i) => (
              <Card key={i.id} className="!p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2"><b>{i.number}</b><Pill value={i.display_status} /><span className="text-xs capitalize text-slate-500">{i.type}</span></div>
                    <p className="text-sm text-slate-500">{money(i.total, i.currency)} · due {fmtDate(i.due_date)}</p>
                  </div>
                  <div className="flex gap-2">
                    <a href={`/api/invoices/${i.id}/pdf`} target="_blank" rel="noreferrer"><Button size="sm" variant="secondary">PDF</Button></a>
                    <Link to={`/invoices/${i.id}?back=${back}`}><Button size="sm">Edit / send</Button></Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </StepShell>
  );
}

function GenCard({ title, desc, onClick, busy, disabled, children }) {
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 p-4">
      <p className="font-semibold">{title}</p>
      <p className="mb-3 mt-1 flex-1 text-sm text-slate-500">{desc}</p>
      {children}
      <Button size="sm" variant="secondary" loading={busy} disabled={disabled} onClick={onClick}>Create draft</Button>
    </div>
  );
}
