import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Card, Empty, PageHeader, Button, Modal, Field, Input, Textarea, useToast } from '../components/ui.jsx';
import { Term } from '../components/Help.jsx';

export const EMPTY_CLIENT = { name: '', company: '', email: '', phone: '', address: '', tax_id: '', payment_method: '', notes: '' };

export function ClientForm({ value, onChange }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Contact name *"><Input value={value.name} onChange={set('name')} placeholder="Jane Doe" /></Field>
      <Field label="Company"><Input value={value.company} onChange={set('company')} placeholder="Acme Ltd" /></Field>
      <Field label="Email" hint="Where invoices and reminders go."><Input type="email" value={value.email} onChange={set('email')} placeholder="jane@acme.com" /></Field>
      <Field label="Phone"><Input value={value.phone} onChange={set('phone')} /></Field>
      <Field label="Billing address" className="sm:col-span-2"><Textarea className="!min-h-[60px]" value={value.address} onChange={set('address')} /></Field>
      <Field label={<><Term t="tax id">Tax ID</Term> (optional)</>} hint="Some companies need their tax number on your invoice."><Input value={value.tax_id} onChange={set('tax_id')} /></Field>
      <Field label="How they prefer to pay" hint="e.g. bank transfer, PayPal, Wise, card."><Input value={value.payment_method} onChange={set('payment_method')} /></Field>
      <Field label="Notes" className="sm:col-span-2"><Textarea className="!min-h-[60px]" value={value.notes} onChange={set('notes')} placeholder="Anything worth remembering about this client" /></Field>
    </div>
  );
}

export default function Clients() {
  const [rows, setRows] = useState(null);
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const load = () => api.get('/clients').then(setRows);
  useEffect(() => { load(); }, []);
  const save = async () => {
    setSaving(true);
    try {
      if (edit.id) await api.put(`/clients/${edit.id}`, edit); else await api.post('/clients', edit);
      toast('Client saved'); setEdit(null); load();
    } catch (e) { toast(e.message, 'error'); } finally { setSaving(false); }
  };
  const del = async (c) => {
    if (!confirm(`Delete ${c.name}? Their contracts stay but lose the client link.`)) return;
    await api.del(`/clients/${c.id}`); load();
  };
  return (
    <div>
      <PageHeader title="Clients" subtitle="Saved once, reused on every contract and invoice." actions={<Button onClick={() => setEdit({ ...EMPTY_CLIENT })}>＋ Add client</Button>} />
      {!rows ? <p className="text-slate-500">Loading…</p> : !rows.length ? <Empty title="No clients yet">They're added automatically in step 2 of the wizard, or add one here.</Empty> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => (
            <Card key={c.id} className="!p-4">
              <p className="font-semibold">{c.name}</p>
              <p className="text-sm text-slate-500">{c.company || ' '}</p>
              <p className="mt-2 truncate text-sm">{c.email || 'No email'}</p>
              <p className="text-xs text-slate-400">{c.contract_count} contract(s)</p>
              <div className="mt-3 flex gap-2"><Button size="sm" variant="secondary" onClick={() => setEdit(c)}>Edit</Button><Button size="sm" variant="danger" onClick={() => del(c)}>Delete</Button></div>
            </Card>
          ))}
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit client' : 'New client'} wide>
        {edit && <ClientForm value={edit} onChange={setEdit} />}
        <div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button loading={saving} onClick={save}>Save</Button></div>
      </Modal>
    </div>
  );
}
