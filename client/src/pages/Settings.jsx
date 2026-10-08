import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Card, PageHeader, Button, Field, Input, Textarea, Select, useToast } from '../components/ui.jsx';
import { Term } from '../components/Help.jsx';
import { CURRENCIES } from '../money.js';

export default function Settings() {
  const [b, setB] = useState(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  useEffect(() => { api.get('/settings/business').then(setB); }, []);
  if (!b) return <p className="text-slate-500">Loading…</p>;
  const set = (k) => (e) => setB({ ...b, [k]: e.target.value });
  const save = async () => {
    setSaving(true);
    try { setB(await api.put('/settings/business', b)); toast('Saved'); } catch (e) { toast(e.message, 'error'); } finally { setSaving(false); }
  };
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" />
      <Link to="/settings/models" className="block">
        <Card className="flex items-center justify-between !p-5 hover:border-indigo-300">
          <div><p className="font-semibold">✦ AI Models</p><p className="text-sm text-slate-500">Add and order the AI models that power the coach. If one fails, the next one answers.</p></div>
          <span className="text-indigo-600">→</span>
        </Card>
      </Link>
      <Card>
        <h2 className="font-semibold">My business</h2>
        <p className="mb-4 text-sm text-slate-500">This appears on your invoices as the person to be paid.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Your name"><Input value={b.name} onChange={set('name')} /></Field>
          <Field label="Business name (optional)"><Input value={b.business_name} onChange={set('business_name')} /></Field>
          <Field label="Email"><Input type="email" value={b.email} onChange={set('email')} /></Field>
          <Field label="Phone"><Input value={b.phone} onChange={set('phone')} /></Field>
          <Field label="Address" className="sm:col-span-2"><Textarea className="!min-h-[60px]" value={b.address} onChange={set('address')} /></Field>
          <Field label={<Term t="tax id">Tax ID</Term>} hint="Optional. Only if you have one."><Input value={b.tax_id} onChange={set('tax_id')} /></Field>
          <Field label="Default currency"><Select value={b.default_currency} onChange={set('default_currency')}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label={<>Default <Term t="net terms">payment terms</Term> (days)</>} hint="14 is a good beginner default."><Input type="number" min="0" value={b.default_net_days} onChange={set('default_net_days')} /></Field>
          <Field label="Default tax rate (%)" hint={<>Leave 0 unless you're registered for <Term t="vat">VAT</Term>/sales tax.</>}><Input type="number" min="0" step="0.1" value={b.default_tax_rate} onChange={set('default_tax_rate')} /></Field>
          <Field label="How clients pay you" className="sm:col-span-2" hint="Bank name, account number, PayPal email, etc. Printed on every invoice."><Textarea value={b.payment_details} onChange={set('payment_details')} /></Field>
        </div>
        <div className="mt-4 flex justify-end"><Button loading={saving} onClick={save}>Save</Button></div>
      </Card>
    </div>
  );
}
