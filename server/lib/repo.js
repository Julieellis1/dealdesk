// Small data-access helpers shared by routes.
import { db, parseJSON, getSetting } from './db.js';
import { invoiceTotals, today, daysBetween } from './money.js';

export function hydrateClient(row) { return row || null; }

export function hydrateContract(row) {
  if (!row) return null;
  return {
    ...row,
    signed: !!row.signed,
    terms: parseJSON(row.terms, {}),
    job: parseJSON(row.job, {}),
    pricing: parseJSON(row.pricing, {}),
    ai: parseJSON(row.ai, {}),
  };
}

export function hydrateInvoice(row) {
  if (!row) return null;
  const inv = { ...row, items: parseJSON(row.items, []), recurrence: parseJSON(row.recurrence, {}) };
  Object.assign(inv, invoiceTotals(inv));
  inv.display_status = inv.status === 'sent' && inv.due_date < today() ? 'overdue' : inv.status;
  inv.days_overdue = inv.display_status === 'overdue' ? daysBetween(inv.due_date, today()) : 0;
  return inv;
}

export function getContract(id, { full = true } = {}) {
  const c = hydrateContract(db.prepare('SELECT * FROM contracts WHERE id = ?').get(id));
  if (!c || !full) return c;
  c.client = c.client_id ? db.prepare('SELECT * FROM clients WHERE id = ?').get(c.client_id) : null;
  c.rounds = db.prepare('SELECT * FROM negotiation_rounds WHERE contract_id = ? ORDER BY round_date ASC, id ASC').all(id);
  c.invoices = db.prepare('SELECT * FROM invoices WHERE contract_id = ? ORDER BY id ASC').all(id).map(hydrateInvoice);
  return c;
}

export function getInvoice(id) {
  const inv = hydrateInvoice(db.prepare('SELECT * FROM invoices WHERE id = ?').get(id));
  if (!inv) return null;
  inv.client = inv.client_id ? db.prepare('SELECT * FROM clients WHERE id = ?').get(inv.client_id) : null;
  inv.contract = inv.contract_id ? db.prepare('SELECT id, title FROM contracts WHERE id = ?').get(inv.contract_id) : null;
  return inv;
}

export function business() {
  return {
    name: '', business_name: '', email: '', phone: '', address: '', tax_id: '',
    default_currency: 'USD', default_net_days: 14, default_tax_rate: 0, payment_details: '',
    ...getSetting('business', {}),
  };
}

export function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const row = db.prepare("SELECT number FROM invoices WHERE number LIKE ? ORDER BY number DESC LIMIT 1").get(`${prefix}%`);
  const n = row ? parseInt(row.number.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(n).padStart(4, '0')}`;
}

export function touch(table, id) {
  db.prepare(`UPDATE ${table} SET updated_at = datetime('now') WHERE id = ?`).run(id);
}
