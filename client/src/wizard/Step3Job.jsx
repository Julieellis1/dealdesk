import { Card, Field, Input, Textarea, Select, Button } from '../components/ui.jsx';
import { Term } from '../components/Help.jsx';
import { money, CURRENCIES, round2 } from '../money.js';
import { StepShell, useWizard } from './Wizard.jsx';

export function jobTotal(job = {}) {
  return job.pricing_type === 'hourly' ? round2((Number(job.rate) || 0) * (Number(job.estimated_hours) || 0)) : round2(job.fixed_price);
}

export default function Step3Job() {
  const { c, setIn } = useWizard();
  const job = c.job || {};
  const s = (k) => (e) => setIn('job', k, e.target.value);
  const cur = job.currency || 'USD';
  const milestones = job.milestones || [];
  const expenses = job.expenses || [];
  const setList = (k, list) => setIn('job', k, list);
  const total = jobTotal(job);
  const pctSum = milestones.reduce((a, m) => a + (Number(m.percent) || 0), 0);

  return (
    <StepShell title="Job details"
      intro="Describe the work itself: what you'll hand over, by when, and how it's priced."
      why={<>
        <p>Clear <Term t="deliverables">deliverables</Term> and dates are your protection against <Term t="scope creep">scope creep</Term>. If it isn't written down, the client can reasonably expect it “included”.</p>
        <p>Splitting work into <Term t="milestone">milestones</Term> lets you get paid in stages instead of waiting until the very end.</p>
      </>}
      askSuggestions={['How do I write good deliverables?', 'Should I charge hourly or a fixed price?', 'How many milestones should a project have?']}>
      <Card className="space-y-4">
        <Field label={<Term t="deliverables">Deliverables</Term>} hint="One per line. Be specific: quantities, formats, number of revision rounds.">
          <Textarea className="min-h-[120px]" value={job.deliverables || ''} onChange={s('deliverables')} placeholder={'5-page responsive website\nUp to 2 rounds of revisions\nHandover call (1 hour)'} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Start date"><Input type="date" value={job.start_date || ''} onChange={s('start_date')} /></Field>
          <Field label="Final deadline"><Input type="date" value={job.end_date || ''} onChange={s('end_date')} /></Field>
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 font-semibold">How is it priced?</h3>
        <div className="mb-4 grid grid-cols-2 gap-2">
          {[['fixed', 'Fixed price', 'One price for the whole job'], ['hourly', 'Hourly rate', 'Paid for the time you spend']].map(([v, l, h]) => (
            <button key={v} onClick={() => setIn('job', 'pricing_type', v)} className={`rounded-xl border p-3 text-left ${job.pricing_type === v ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100' : 'border-slate-200'}`}>
              <p className="font-medium">{l}</p><p className="text-xs text-slate-500">{h}</p>
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Currency"><Select value={cur} onChange={s('currency')}>{[...new Set([cur, ...CURRENCIES])].map((x) => <option key={x}>{x}</option>)}</Select></Field>
          {job.pricing_type === 'hourly' ? (<>
            <Field label="Hourly rate"><Input type="number" min="0" step="any" value={job.rate || ''} onChange={s('rate')} /></Field>
            <Field label="Estimated hours" hint="Add 15-25% buffer; things take longer."><Input type="number" min="0" step="any" value={job.estimated_hours || ''} onChange={s('estimated_hours')} /></Field>
          </>) : (
            <Field label="Price offered / expected" hint="What the client offered, or what you plan to quote. You'll refine it in step 4."><Input type="number" min="0" step="any" value={job.fixed_price || ''} onChange={s('fixed_price')} /></Field>
          )}
        </div>
        {total > 0 && <p className="mt-3 text-sm text-slate-600">Job value: <b>{money(total, cur)}</b></p>}
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div><h3 className="font-semibold"><Term t="milestone">Milestones</Term></h3><p className="text-sm text-slate-500">Optional checkpoints. Give each a share of the price (%) or a fixed amount.</p></div>
          <Button size="sm" variant="secondary" onClick={() => setList('milestones', [...milestones, { name: '', due_date: '', percent: '', amount: '', description: '' }])}>＋ Add</Button>
        </div>
        <div className="space-y-2">
          {milestones.map((m, i) => {
            const up = (k) => (e) => setList('milestones', milestones.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)));
            return (
              <div key={i} className="grid grid-cols-12 gap-2 rounded-xl bg-slate-50 p-2">
                <Input className="col-span-12 sm:col-span-4" placeholder="e.g. Design approved" value={m.name} onChange={up('name')} />
                <Input className="col-span-6 sm:col-span-3" type="date" value={m.due_date} onChange={up('due_date')} />
                <Input className="col-span-3 sm:col-span-2" type="number" placeholder="%" value={m.percent} onChange={up('percent')} />
                <Input className="col-span-3 sm:col-span-2" type="number" placeholder="or amount" value={m.amount} onChange={up('amount')} />
                <button className="col-span-12 text-sm text-slate-400 hover:text-red-600 sm:col-span-1" onClick={() => setList('milestones', milestones.filter((_, j) => j !== i))}>✕</button>
              </div>
            );
          })}
          {milestones.length > 0 && pctSum > 0 && <p className={`text-xs ${Math.abs(pctSum - 100) < 0.5 ? 'text-emerald-700' : 'text-amber-700'}`}>Percentages add up to {pctSum}%{Math.abs(pctSum - 100) < 0.5 ? ' ✓' : ' (should be 100%)'}</p>}
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div><h3 className="font-semibold">Expenses</h3><p className="text-sm text-slate-500">Costs you'll pay for the job (software, travel, stock photos). Tick “bill client” to add them to the invoice.</p></div>
          <Button size="sm" variant="secondary" onClick={() => setList('expenses', [...expenses, { description: '', amount: '', billable: true }])}>＋ Add</Button>
        </div>
        <div className="space-y-2">
          {expenses.map((x, i) => {
            const up = (k, v) => setList('expenses', expenses.map((e, j) => (j === i ? { ...e, [k]: v } : e)));
            return (
              <div key={i} className="grid grid-cols-12 items-center gap-2 rounded-xl bg-slate-50 p-2">
                <Input className="col-span-12 sm:col-span-6" placeholder="Description" value={x.description} onChange={(e) => up('description', e.target.value)} />
                <Input className="col-span-5 sm:col-span-3" type="number" placeholder="Amount" value={x.amount} onChange={(e) => up('amount', e.target.value)} />
                <label className="col-span-5 flex items-center gap-1.5 text-sm sm:col-span-2"><input type="checkbox" checked={!!x.billable} onChange={(e) => up('billable', e.target.checked)} /> Bill client</label>
                <button className="col-span-2 text-sm text-slate-400 hover:text-red-600 sm:col-span-1" onClick={() => setList('expenses', expenses.filter((_, j) => j !== i))}>✕</button>
              </div>
            );
          })}
        </div>
      </Card>
    </StepShell>
  );
}
