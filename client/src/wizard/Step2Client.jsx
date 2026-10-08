import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Card, Field, Select, Button, useToast } from '../components/ui.jsx';
import { ClientForm, EMPTY_CLIENT } from '../pages/Clients.jsx';
import { StepShell, useWizard } from './Wizard.jsx';

export default function Step2Client() {
  const { c, set, flush, beforeLeave } = useWizard();
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState(c.client ? { ...EMPTY_CLIENT, ...c.client } : { ...EMPTY_CLIENT });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => { api.get('/clients').then(setClients); }, []);

  const saveClient = async () => {
    if (!dirty) return true;
    if (!form.name.trim()) { toast('Add the client\'s name (or pick a saved client).', 'error'); return false; }
    setSaving(true);
    try {
      const saved = form.id ? await api.put(`/clients/${form.id}`, form) : await api.post('/clients', form);
      setForm({ ...EMPTY_CLIENT, ...saved }); setDirty(false);
      set({ client_id: saved.id, client: saved });
      await flush({ client_id: saved.id });
      setClients(await api.get('/clients'));
      return true;
    } catch (e) { toast(e.message, 'error'); return false; } finally { setSaving(false); }
  };

  // Save the client automatically when moving to another step.
  useEffect(() => { beforeLeave.current = saveClient; return () => { beforeLeave.current = null; }; });

  const pick = (idStr) => {
    if (!idStr) { setForm({ ...EMPTY_CLIENT }); setDirty(false); set({ client_id: null, client: null }); return; }
    const cl = clients.find((x) => x.id === Number(idStr));
    setForm({ ...EMPTY_CLIENT, ...cl }); setDirty(false);
    set({ client_id: cl.id, client: cl });
  };

  return (
    <StepShell title="Client details"
      intro="Who is hiring you? Saved clients can be reused on future contracts."
      why={<>
        <p>Invoices need the <b>exact legal name and billing details</b> of whoever pays you. Wrong details are a common reason invoices get “stuck” in a client's accounts department.</p>
        <p>Knowing how they like to pay (bank transfer, PayPal…) avoids back-and-forth when it's time to get paid.</p>
      </>}
      askSuggestions={['What details should I get from a new client?', 'Do I need the client\'s tax ID?', 'Which payment method is safest for freelancers?']}>
      <Card>
        <Field label="Choose a saved client or add a new one" className="mb-5">
          <Select value={form.id || ''} onChange={(e) => pick(e.target.value)}>
            <option value="">＋ New client</option>
            {clients.map((cl) => <option key={cl.id} value={cl.id}>{cl.company ? `${cl.company} (${cl.name})` : cl.name}</option>)}
          </Select>
        </Field>
        <ClientForm value={form} onChange={(v) => { setForm(v); setDirty(true); }} />
        <div className="mt-4 flex items-center justify-end gap-3">
          {c.client_id && !dirty && <span className="text-sm text-emerald-700">✓ Linked to this contract</span>}
          <Button variant="secondary" loading={saving} disabled={!dirty} onClick={async () => { if (await saveClient()) toast('Client saved'); }}>{form.id ? 'Save changes' : 'Save client'}</Button>
        </div>
      </Card>
    </StepShell>
  );
}
