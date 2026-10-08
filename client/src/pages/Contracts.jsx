import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Card, Pill, Empty, Button, PageHeader, Tabs, useToast } from '../components/ui.jsx';
import { NewContractButton } from '../components/NewContract.jsx';
import { fmtDate } from '../money.js';

const STEP = ['Contract', 'Client', 'Job', 'Price & negotiate', 'Invoices', 'Finalize'];

export default function Contracts() {
  const [rows, setRows] = useState(null);
  const [tab, setTab] = useState('all');
  const toast = useToast();
  const load = () => api.get('/contracts').then(setRows);
  useEffect(() => { load(); }, []);
  const del = async (c) => {
    if (!confirm(`Delete "${c.title}" and its invoices and negotiation history? This cannot be undone.`)) return;
    await api.del(`/contracts/${c.id}`); toast('Contract deleted'); load();
  };
  const list = (rows || []).filter((c) => tab === 'all' || c.status === tab);
  return (
    <div>
      <PageHeader title="Contracts" subtitle="Every deal, from first offer to signed." actions={<NewContractButton />} />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'all', label: 'All' }, { id: 'draft', label: 'Draft' }, { id: 'negotiating', label: 'Negotiating' }, { id: 'agreed', label: 'Agreed' }, { id: 'submitted', label: 'Submitted' }]} />
      {!rows ? <p className="text-slate-500">Loading…</p> : !list.length ? <Empty title="No contracts here yet">Start with “I have a new contract”.</Empty> : (
        <div className="grid gap-3">
          {list.map((c) => (
            <Card key={c.id} className="!p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><p className="truncate font-semibold">{c.title}</p><Pill value={c.status} />{c.signed && <Pill value="paid">signed</Pill>}</div>
                  <p className="mt-0.5 text-sm text-slate-500">{c.client_company || c.client_name || 'No client yet'} · updated {fmtDate(c.updated_at)}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 w-40 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-indigo-500" style={{ width: `${(c.wizard_step / 6) * 100}%` }} /></div>
                    <span className="text-xs text-slate-500">Step {c.wizard_step}: {STEP[c.wizard_step - 1]}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link to={`/contracts/${c.id}/step/${c.wizard_step}`}><Button size="sm">{c.status === 'submitted' ? 'Open' : 'Resume'}</Button></Link>
                  <Button size="sm" variant="danger" onClick={() => del(c)}>Delete</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
