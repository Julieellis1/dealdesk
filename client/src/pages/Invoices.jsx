import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { Card, Pill, Empty, PageHeader, Tabs, Button } from '../components/ui.jsx';
import { money, fmtDate } from '../money.js';

export default function Invoices() {
  const [rows, setRows] = useState(null);
  const [params, setParams] = useSearchParams();
  const tab = params.get('status') || 'all';
  useEffect(() => { api.get('/invoices').then(setRows); }, []);
  const list = (rows || []).filter((i) => tab === 'all' || i.display_status === tab);
  return (
    <div>
      <PageHeader title="Invoices" subtitle="Create invoices from a contract (wizard step 5), then track them here." />
      <Tabs value={tab} onChange={(v) => setParams(v === 'all' ? {} : { status: v })} tabs={[{ id: 'all', label: 'All' }, { id: 'draft', label: 'Draft' }, { id: 'sent', label: 'Sent' }, { id: 'overdue', label: 'Overdue' }, { id: 'paid', label: 'Paid' }]} />
      {!rows ? <p className="text-slate-500">Loading…</p> : !list.length ? <Empty title="No invoices here">Open a contract and go to step 5 to generate one from the agreed terms.</Empty> : (
        <Card className="!p-0 overflow-hidden">
          <div className="divide-y divide-slate-100">
            {list.map((i) => (
              <Link key={i.id} to={`/invoices/${i.id}`} className="flex flex-col gap-1 p-4 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><span className="font-semibold">{i.number}</span><Pill value={i.display_status} /><span className="text-xs capitalize text-slate-400">{i.type}</span></div>
                  <p className="truncate text-sm text-slate-500">{i.client_company || i.client_name || 'No client'}{i.contract_title ? ` · ${i.contract_title}` : ''}</p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="font-semibold">{money(i.total, i.currency)}</p>
                  <p className={`text-xs ${i.display_status === 'overdue' ? 'text-red-600' : 'text-slate-500'}`}>{i.status === 'paid' ? `Paid ${fmtDate(i.paid_at)}` : `Due ${fmtDate(i.due_date)}${i.days_overdue ? ` · ${i.days_overdue}d late` : ''}`}</p>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
