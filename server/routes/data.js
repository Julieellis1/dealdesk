import { Router } from 'express';
import multer from 'multer';
import { db, setSetting } from '../lib/db.js';
import { getContract, getInvoice, hydrateContract, hydrateInvoice, business, nextInvoiceNumber, touch } from '../lib/repo.js';
import { invoiceTotals, today, addDays, addInterval, round2, daysBetween } from '../lib/money.js';
import { extractText } from '../lib/extract.js';
import { invoicePdf, pdfToBuffer } from '../lib/pdf.js';
import { sendMail, mailConfigured } from '../lib/mail.js';
import { randomToken } from '../lib/crypto.js';
import { config } from '../lib/config.js';

const r = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

function updateRow(table, id, fields, jsonFields = []) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const vals = keys.map((k) => (jsonFields.includes(k) ? JSON.stringify(fields[k] ?? {}) : typeof fields[k] === 'boolean' ? Number(fields[k]) : fields[k]));
  db.prepare(`UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...vals, id);
}

/* ---------- Settings: my business ---------- */
r.get('/settings/business', (req, res) => res.json(business()));
r.put('/settings/business', (req, res) => {
  const b = pick(req.body || {}, ['name', 'business_name', 'email', 'phone', 'address', 'tax_id', 'default_currency', 'default_net_days', 'default_tax_rate', 'payment_details']);
  setSetting('business', { ...business(), ...b });
  res.json(business());
});
r.get('/meta', (req, res) => res.json({ mailConfigured: mailConfigured(), publicUrl: config.publicUrl }));

/* ---------- Clients ---------- */
const CLIENT_FIELDS = ['name', 'company', 'email', 'phone', 'address', 'tax_id', 'payment_method', 'notes'];
r.get('/clients', (req, res) => {
  res.json(db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM contracts WHERE client_id = c.id) AS contract_count FROM clients c ORDER BY name COLLATE NOCASE`).all());
});
r.post('/clients', (req, res) => {
  const f = pick(req.body || {}, CLIENT_FIELDS);
  if (!f.name?.trim()) return bad(res, 'The client needs a name.');
  const keys = Object.keys(f);
  const info = db.prepare(`INSERT INTO clients (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map((k) => f[k]));
  res.status(201).json(db.prepare('SELECT * FROM clients WHERE id = ?').get(info.lastInsertRowid));
});
r.put('/clients/:id', (req, res) => {
  const f = pick(req.body || {}, CLIENT_FIELDS);
  if (f.name !== undefined && !f.name.trim()) return bad(res, 'The client needs a name.');
  updateRow('clients', req.params.id, f);
  const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  row ? res.json(row) : bad(res, 'Client not found', 404);
});
r.delete('/clients/:id', (req, res) => {
  db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

/* ---------- Contracts ---------- */
const STAGES = ['draft', 'negotiating', 'agreed', 'submitted'];
r.get('/contracts', (req, res) => {
  const rows = db.prepare(`SELECT c.*, cl.name AS client_name, cl.company AS client_company FROM contracts c LEFT JOIN clients cl ON cl.id = c.client_id ORDER BY c.updated_at DESC`).all();
  res.json(rows.map((row) => ({ ...hydrateContract(row), client_name: row.client_name, client_company: row.client_company })));
});
r.post('/contracts', (req, res) => {
  const title = (req.body?.title || '').trim() || 'Untitled contract';
  const biz = business();
  const info = db.prepare('INSERT INTO contracts (title, job) VALUES (?, ?)').run(title, JSON.stringify({ currency: biz.default_currency || 'USD', pricing_type: 'fixed', milestones: [], expenses: [] }));
  res.status(201).json(getContract(info.lastInsertRowid));
});
r.get('/contracts/:id', (req, res) => {
  const c = getContract(req.params.id);
  c ? res.json(c) : bad(res, 'Contract not found', 404);
});
r.put('/contracts/:id', (req, res) => {
  const existing = getContract(req.params.id, { full: false });
  if (!existing) return bad(res, 'Contract not found', 404);
  const f = pick(req.body || {}, ['title', 'status', 'signed', 'wizard_step', 'client_id', 'contract_text', 'terms', 'job', 'pricing', 'final_summary', 'ai']);
  if (f.status && !STAGES.includes(f.status)) return bad(res, 'Unknown status');
  if (f.status === 'submitted' && existing.status !== 'submitted') f.submitted_at = new Date().toISOString();
  if (f.wizard_step) f.wizard_step = Math.min(6, Math.max(1, Number(f.wizard_step)));
  updateRow('contracts', req.params.id, f, ['terms', 'job', 'pricing', 'ai']);
  res.json(getContract(req.params.id));
});
r.delete('/contracts/:id', (req, res) => {
  db.prepare('DELETE FROM contracts WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});
r.post('/extract', upload.single('file'), async (req, res) => {
  if (!req.file) return bad(res, 'No file received.');
  const text = (await extractText(req.file)).replace(/\n{3,}/g, '\n\n').trim();
  if (!text) return bad(res, 'No readable text found in that file (it may be a scanned image). Try pasting the text instead.');
  res.json({ text, chars: text.length });
});

/* ---------- Negotiation rounds ---------- */
r.post('/contracts/:id/rounds', (req, res) => {
  const c = getContract(req.params.id, { full: false });
  if (!c) return bad(res, 'Contract not found', 404);
  const { party = 'me', kind = 'offer', amount = null, notes = '', round_date = today() } = req.body || {};
  if (!['me', 'client'].includes(party)) return bad(res, 'party must be me or client');
  if (!['offer', 'counter', 'accepted', 'rejected', 'note'].includes(kind)) return bad(res, 'Unknown round type');
  db.prepare('INSERT INTO negotiation_rounds (contract_id, round_date, party, kind, amount, notes) VALUES (?,?,?,?,?,?)')
    .run(c.id, round_date, party, kind, amount === '' || amount == null ? null : Number(amount), notes);
  if (c.status === 'draft') db.prepare("UPDATE contracts SET status = 'negotiating' WHERE id = ?").run(c.id);
  touch('contracts', c.id);
  res.status(201).json(getContract(c.id));
});
r.delete('/rounds/:id', (req, res) => {
  const row = db.prepare('SELECT contract_id FROM negotiation_rounds WHERE id = ?').get(req.params.id);
  db.prepare('DELETE FROM negotiation_rounds WHERE id = ?').run(req.params.id);
  res.json(row ? getContract(row.contract_id) : { ok: true });
});

/* ---------- Invoices ---------- */
const INV_FIELDS = ['number', 'contract_id', 'client_id', 'type', 'status', 'issue_date', 'due_date', 'currency', 'items', 'tax_rate', 'discount', 'notes', 'payment_instructions', 'recurrence'];

function cleanItems(items) {
  return (Array.isArray(items) ? items : []).map((it) => ({
    description: String(it.description || ''),
    quantity: Number(it.quantity) || 0,
    unit_price: round2(it.unit_price),
  }));
}

function insertInvoice(f) {
  const biz = business();
  const issue = f.issue_date || today();
  const row = {
    number: f.number || nextInvoiceNumber(),
    contract_id: f.contract_id || null,
    client_id: f.client_id || null,
    type: f.type || 'single',
    status: 'draft',
    issue_date: issue,
    due_date: f.due_date || addDays(issue, biz.default_net_days ?? 14),
    currency: f.currency || biz.default_currency || 'USD',
    items: JSON.stringify(cleanItems(f.items)),
    tax_rate: Number(f.tax_rate ?? biz.default_tax_rate ?? 0) || 0,
    discount: Number(f.discount) || 0,
    notes: f.notes || '',
    payment_instructions: f.payment_instructions ?? biz.payment_details ?? '',
    recurrence: JSON.stringify(f.recurrence || {}),
  };
  const keys = Object.keys(row);
  const info = db.prepare(`INSERT INTO invoices (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map((k) => row[k]));
  return getInvoice(info.lastInsertRowid);
}

r.get('/invoices', (req, res) => {
  const rows = db.prepare(`SELECT i.*, cl.name AS client_name, cl.company AS client_company, c.title AS contract_title
    FROM invoices i LEFT JOIN clients cl ON cl.id = i.client_id LEFT JOIN contracts c ON c.id = i.contract_id ORDER BY i.issue_date DESC, i.id DESC`).all();
  res.json(rows.map((row) => ({ ...hydrateInvoice(row), client_name: row.client_name, client_company: row.client_company, contract_title: row.contract_title })));
});
r.get('/invoices/:id', (req, res) => {
  const inv = getInvoice(req.params.id);
  inv ? res.json(inv) : bad(res, 'Invoice not found', 404);
});
r.post('/invoices', (req, res) => res.status(201).json(insertInvoice(req.body || {})));
r.put('/invoices/:id', (req, res) => {
  if (!getInvoice(req.params.id)) return bad(res, 'Invoice not found', 404);
  const f = pick(req.body || {}, INV_FIELDS);
  if (f.items) f.items = cleanItems(f.items);
  if (f.status && !['draft', 'sent', 'paid'].includes(f.status)) return bad(res, 'Unknown status');
  if (f.status === 'sent') f.sent_at = new Date().toISOString();
  if (f.status === 'paid') f.paid_at = new Date().toISOString();
  try { updateRow('invoices', req.params.id, f, ['items', 'recurrence']); }
  catch (e) { if (String(e.message).includes('UNIQUE')) return bad(res, 'That invoice number is already used.'); throw e; }
  res.json(getInvoice(req.params.id));
});
r.delete('/invoices/:id', (req, res) => {
  db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Build a draft invoice from the agreed terms of a contract.
r.post('/contracts/:id/invoices/generate', (req, res) => {
  const c = getContract(req.params.id);
  if (!c) return bad(res, 'Contract not found', 404);
  const { type = 'single', milestone_index, interval = 'monthly' } = req.body || {};
  const job = c.job || {}, p = c.pricing || {};
  const currency = p.agreed_currency || job.currency || business().default_currency || 'USD';
  const jobTotal = job.pricing_type === 'hourly'
    ? round2((Number(job.rate) || 0) * (Number(job.estimated_hours) || 0))
    : round2(job.fixed_price);
  const agreed = Number(p.agreed_amount) || jobTotal;
  const depositPct = Number(p.deposit_percent) || 0;
  const already = c.invoices.filter((i) => i.type === 'deposit').reduce((s, i) => s + i.subtotal, 0);
  const net = p.net_days !== undefined && p.net_days !== '' ? Number(p.net_days) : undefined;
  const issue = today();
  const base = { contract_id: c.id, client_id: c.client_id, currency, type, issue_date: issue, due_date: net !== undefined ? addDays(issue, net) : undefined };
  const title = c.title || 'Project';
  let items = [];

  if (type === 'deposit') {
    if (!depositPct) return bad(res, 'Set a deposit % in the agreed terms (step 4) first.');
    items = [{ description: `${title}: ${depositPct}% deposit to start work`, quantity: 1, unit_price: round2(agreed * depositPct / 100) }];
    base.due_date = issue; // deposits are usually due on receipt
    base.notes = 'Work begins once this deposit is received.';
  } else if (type === 'milestone') {
    const m = (job.milestones || [])[Number(milestone_index)];
    if (!m) return bad(res, 'Pick a milestone (add milestones in step 3).');
    const amt = Number(m.amount) || round2(agreed * (Number(m.percent) || 0) / 100);
    items = [{ description: `${title}: milestone "${m.name}"${m.description ? ` (${m.description})` : ''}`, quantity: 1, unit_price: amt }];
  } else if (type === 'recurring') {
    const amt = Number(p.recurring_amount) || agreed;
    items = [{ description: `${title}: ${interval} fee`, quantity: 1, unit_price: amt }];
    base.recurrence = { interval, next_date: addInterval(issue, interval) };
  } else {
    if (job.pricing_type === 'hourly' && !p.agreed_amount) {
      items = [{ description: `${title}: ${job.deliverables ? job.deliverables.split('\n')[0].slice(0, 80) : 'services'}`, quantity: Number(job.estimated_hours) || 1, unit_price: Number(job.rate) || 0 }];
    } else {
      items = [{ description: `${title}${job.deliverables ? `: ${job.deliverables.split('\n')[0].slice(0, 80)}` : ''}`, quantity: 1, unit_price: agreed }];
    }
    if (already > 0) items.push({ description: 'Less deposit already invoiced', quantity: 1, unit_price: -round2(already) });
  }
  for (const e of job.expenses || []) {
    if (e.billable && type !== 'deposit' && type !== 'recurring' && Number(e.amount)) items.push({ description: `Expense: ${e.description}`, quantity: 1, unit_price: Number(e.amount) });
  }
  if (c.client?.payment_method) base.payment_instructions = [business().payment_details, `Client's preferred method: ${c.client.payment_method}`].filter(Boolean).join('\n');
  res.status(201).json(insertInvoice({ ...base, items }));
});

r.post('/invoices/:id/next', (req, res) => {
  const inv = getInvoice(req.params.id);
  if (!inv) return bad(res, 'Invoice not found', 404);
  if (inv.type !== 'recurring') return bad(res, 'Only recurring invoices have a "next" invoice.');
  const interval = inv.recurrence.interval || 'monthly';
  const issue = inv.recurrence.next_date || addInterval(inv.issue_date, interval);
  const gap = daysBetween(inv.issue_date, inv.due_date);
  const created = insertInvoice({
    contract_id: inv.contract_id, client_id: inv.client_id, type: 'recurring', currency: inv.currency, items: inv.items,
    tax_rate: inv.tax_rate, discount: inv.discount, notes: inv.notes, payment_instructions: inv.payment_instructions,
    issue_date: issue, due_date: addDays(issue, gap), recurrence: { interval, next_date: addInterval(issue, interval) },
  });
  updateRow('invoices', inv.id, { recurrence: { ...inv.recurrence, next_date: null, continued_by: created.id } }, ['recurrence']);
  res.status(201).json(created);
});

r.get('/invoices/:id/pdf', async (req, res) => {
  const inv = getInvoice(req.params.id);
  if (!inv) return bad(res, 'Invoice not found', 404);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${req.query.download ? 'attachment' : 'inline'}; filename="${inv.number}.pdf"`);
  invoicePdf(inv, business()).pipe(res);
});

r.post('/invoices/:id/share', (req, res) => {
  const inv = getInvoice(req.params.id);
  if (!inv) return bad(res, 'Invoice not found', 404);
  let token = inv.share_token;
  if (!token || req.body?.regenerate) {
    token = randomToken();
    db.prepare('UPDATE invoices SET share_token = ? WHERE id = ?').run(token, inv.id);
  }
  res.json({ token, path: `/share/${token}`, url: config.publicUrl ? `${config.publicUrl}/share/${token}` : null });
});
r.delete('/invoices/:id/share', (req, res) => {
  db.prepare('UPDATE invoices SET share_token = NULL WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

r.post('/invoices/:id/email', async (req, res) => {
  const inv = getInvoice(req.params.id);
  if (!inv) return bad(res, 'Invoice not found', 404);
  const { to, subject, message } = req.body || {};
  if (!to || !/^\S+@\S+\.\S+$/.test(to)) return bad(res, 'Enter a valid email address.');
  const pdf = await pdfToBuffer(invoicePdf(inv, business()));
  try {
    await sendMail({ to, subject: subject || `Invoice ${inv.number}`, text: message || '', replyTo: business().email || undefined, attachments: [{ filename: `${inv.number}.pdf`, content: pdf }] });
  } catch (e) {
    if (e.status) throw e;
    return bad(res, `The email could not be sent: ${e.message}. Check the SMTP settings in .env.`, 502);
  }
  if (inv.status === 'draft') updateRow('invoices', inv.id, { status: 'sent', sent_at: new Date().toISOString() });
  res.json(getInvoice(inv.id));
});

/* ---------- Dashboard ---------- */
r.get('/dashboard', (req, res) => {
  const contracts = db.prepare(`SELECT c.*, cl.name AS client_name FROM contracts c LEFT JOIN clients cl ON cl.id = c.client_id ORDER BY c.updated_at DESC`).all()
    .map((row) => ({ ...hydrateContract(row), client_name: row.client_name }));
  const invoices = db.prepare(`SELECT i.*, cl.name AS client_name, cl.email AS client_email, c.title AS contract_title FROM invoices i
    LEFT JOIN clients cl ON cl.id = i.client_id LEFT JOIN contracts c ON c.id = i.contract_id`).all()
    .map((row) => ({ ...hydrateInvoice(row), client_name: row.client_name, client_email: row.client_email, contract_title: row.contract_title }));
  const t = today();
  const horizon = addDays(t, 30);

  const stages = Object.fromEntries(STAGES.map((s) => [s, contracts.filter((c) => c.status === s).map((c) => ({ id: c.id, title: c.title, client_name: c.client_name, wizard_step: c.wizard_step, updated_at: c.updated_at, signed: c.signed }))]));
  const invoiceStatus = { draft: 0, sent: 0, paid: 0, overdue: 0 };
  const outstanding = {}, overdueAmt = {}, paidAmt = {};
  for (const i of invoices) {
    invoiceStatus[i.display_status]++;
    if (i.status === 'sent') outstanding[i.currency] = round2((outstanding[i.currency] || 0) + i.total);
    if (i.display_status === 'overdue') overdueAmt[i.currency] = round2((overdueAmt[i.currency] || 0) + i.total);
    if (i.status === 'paid') paidAmt[i.currency] = round2((paidAmt[i.currency] || 0) + i.total);
  }

  const deadlines = [];
  for (const c of contracts) {
    if (c.status === 'submitted' && c.signed && c.job?.end_date && c.job.end_date < t) continue;
    if (c.job?.end_date && c.job.end_date >= t && c.job.end_date <= horizon) deadlines.push({ date: c.job.end_date, kind: 'Project deadline', title: c.title, contract_id: c.id });
    for (const m of c.job?.milestones || []) {
      if (m.due_date && m.due_date >= t && m.due_date <= horizon) deadlines.push({ date: m.due_date, kind: 'Milestone', title: `${m.name} · ${c.title}`, contract_id: c.id });
    }
  }
  for (const i of invoices) {
    if (i.status === 'sent' && i.due_date >= t && i.due_date <= horizon) deadlines.push({ date: i.due_date, kind: 'Invoice due', title: `${i.number} · ${i.client_name || 'client'}`, invoice_id: i.id });
    if (i.type === 'recurring' && i.recurrence?.next_date && i.recurrence.next_date <= horizon) deadlines.push({ date: i.recurrence.next_date, kind: 'Next recurring invoice', title: i.number, invoice_id: i.id });
  }
  deadlines.sort((a, b) => a.date.localeCompare(b.date));

  // Rule-based suggestions; the AI writes the actual message on request.
  const suggestions = [];
  for (const i of invoices.filter((x) => x.display_status === 'overdue').sort((a, b) => b.days_overdue - a.days_overdue)) {
    suggestions.push({ type: 'overdue', invoice_id: i.id, tone: i.days_overdue > 21 ? 'final' : i.days_overdue > 7 ? 'firm' : 'friendly',
      title: `${i.number} is ${i.days_overdue} day${i.days_overdue === 1 ? '' : 's'} overdue`, detail: `${i.client_name || 'Client'} owes ${i.currency} ${i.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}.` });
  }
  for (const i of invoices.filter((x) => x.status === 'sent' && x.due_date >= t && daysBetween(t, x.due_date) <= 3)) {
    suggestions.push({ type: 'due_soon', invoice_id: i.id, tone: 'friendly', title: `${i.number} is due ${i.due_date === t ? 'today' : `in ${daysBetween(t, i.due_date)} days`}`, detail: 'A short, friendly heads-up now makes on-time payment more likely.' });
  }
  for (const i of invoices.filter((x) => x.status === 'draft' && x.issue_date <= t)) {
    suggestions.push({ type: 'unsent', invoice_id: i.id, title: `${i.number} is still a draft`, detail: 'It hasn\'t been sent yet. Clients can\'t pay what they haven\'t received.' });
  }
  for (const i of invoices.filter((x) => x.type === 'recurring' && x.recurrence?.next_date && x.recurrence.next_date <= t)) {
    suggestions.push({ type: 'recurring', invoice_id: i.id, title: `Time to create the next invoice after ${i.number}`, detail: `It was scheduled for ${i.recurrence.next_date}.` });
  }
  for (const c of contracts.filter((x) => x.status === 'negotiating' && daysBetween(x.updated_at.slice(0, 10), t) >= 5)) {
    suggestions.push({ type: 'stalled', contract_id: c.id, title: `"${c.title}" has been in negotiation for a while`, detail: 'No update in 5+ days. A polite follow-up keeps the deal moving.' });
  }

  res.json({ stages, invoiceStatus, outstanding, overdue: overdueAmt, paid: paidAmt, deadlines: deadlines.slice(0, 12), suggestions: suggestions.slice(0, 10), counts: { contracts: contracts.length, invoices: invoices.length } });
});

export default r;
