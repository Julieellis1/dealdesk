import { Router } from 'express';
import { db } from '../lib/db.js';
import { chat, jsonValidator, AIError } from '../lib/llm.js';
import { prompts } from '../lib/prompts.js';
import { getContract, getInvoice, business } from '../lib/repo.js';
import { round2 } from '../lib/money.js';

const r = Router();

function saveAI(contractId, key, value) {
  const row = db.prepare('SELECT ai FROM contracts WHERE id = ?').get(contractId);
  if (!row) return;
  const ai = JSON.parse(row.ai || '{}');
  ai[key] = value;
  db.prepare("UPDATE contracts SET ai = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(ai), contractId);
}

function needContract(id) {
  const c = id ? getContract(id) : null;
  if (!c) { const e = new Error('Contract not found'); e.status = 404; throw e; }
  return c;
}

const stamp = (out) => ({ model: out.model, attempts: out.attempts, at: new Date().toISOString() });

// 1. Plain-English summary + risky clause flags
r.post('/summarize', async (req, res) => {
  const { contract_id, text, terms } = req.body || {};
  const c = contract_id ? needContract(contract_id) : null;
  const out = await chat(prompts.summarize({ text: text ?? c?.contract_text, terms: terms ?? c?.terms }), { validate: jsonValidator(['plain_summary', 'flags']) });
  const result = { ...out.parsed, ...stamp(out) };
  if (c) saveAI(c.id, 'summary', result);
  res.json(result);
});

// 4a. Fair price range + payment structure + strategies
r.post('/pricing', async (req, res) => {
  const c = needContract(req.body?.contract_id);
  const out = await chat(prompts.pricing({ contract: c, context: req.body?.context || c.pricing?.context }), { validate: jsonValidator(['low', 'fair', 'high']) });
  const result = { ...out.parsed, ...stamp(out) };
  saveAI(c.id, 'pricing', result);
  res.json(result);
});

// 4b. Negotiation emails in three tones
r.post('/scripts', async (req, res) => {
  const c = needContract(req.body?.contract_id);
  const { scenario = 'Propose my price', notes = '' } = req.body || {};
  const out = await chat(prompts.scripts({ contract: c, scenario, notes }), { validate: jsonValidator(['emails']), temperature: 0.6 });
  const result = { scenario, ...out.parsed, ...stamp(out) };
  saveAI(c.id, 'scripts', result);
  res.json(result);
});

// 4c. Likely objections + suggested responses
r.post('/objections', async (req, res) => {
  const c = needContract(req.body?.contract_id);
  const out = await chat(prompts.objections({ contract: c }), { validate: jsonValidator(['objections']), temperature: 0.6 });
  const result = { ...out.parsed, ...stamp(out) };
  saveAI(c.id, 'objections', result);
  res.json(result);
});

// 4d. Live practice: AI plays the client
r.post('/roleplay', async (req, res) => {
  const c = needContract(req.body?.contract_id);
  const history = (req.body?.history || []).slice(-20);
  const out = await chat(prompts.roleplay({ contract: c, history }), { validate: jsonValidator(['client_reply']), temperature: 0.8 });
  res.json({ ...out.parsed, ...stamp(out) });
});

function autoChecks(c) {
  const checks = [];
  const add = (status, title, detail) => checks.push({ status, title, detail, source: 'auto' });
  const job = c.job || {}, p = c.pricing || {}, t = c.terms || {};
  const biz = business();
  if (!c.client) add('missing', 'No client selected', 'Add who you are working for in step 2.');
  else if (!c.client.email) add('warning', 'Client has no email address', 'You will need it to send invoices and reminders.');
  if (!t.scope && !job.deliverables) add('missing', 'Scope of work is empty', 'Write down exactly what you will deliver. Vague scope is the #1 cause of unpaid extra work ("scope creep").');
  if (!t.payment_terms && !p.net_days && p.net_days !== 0) add('missing', 'No payment terms', 'Agree when you get paid, e.g. "Net 14" (within 14 days of the invoice).');
  const jobTotal = job.pricing_type === 'hourly' ? (Number(job.rate) || 0) * (Number(job.estimated_hours) || 0) : Number(job.fixed_price) || 0;
  const agreed = Number(p.agreed_amount) || 0;
  if (!agreed && !jobTotal) add('missing', 'No price agreed', 'Record the agreed amount in step 4.');
  if (!job.end_date && !t.deadlines) add('warning', 'No deadline set', 'A clear end date protects both sides.');
  const ms = job.milestones || [];
  const pctSum = ms.reduce((s, m) => s + (Number(m.percent) || 0), 0);
  if (ms.length && pctSum && Math.abs(pctSum - 100) > 0.5) add('warning', `Milestone percentages add up to ${pctSum}%`, 'They should add up to 100% of the price.');
  const billed = c.invoices.filter((i) => i.type !== 'recurring').reduce((s, i) => s + i.subtotal, 0);
  const target = agreed || jobTotal;
  const billableExp = (job.expenses || []).filter((e) => e.billable).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  if (target && billed && Math.abs(billed - target - billableExp) > Math.max(1, target * 0.01) && billed < target) {
    add('warning', 'Invoices don\'t cover the full price yet', `Invoiced so far: ${round2(billed)}; agreed: ${round2(target)}${billableExp ? ` + ${round2(billableExp)} expenses` : ''}. That's fine if more invoices will follow.`);
  } else if (target && billed > target + billableExp + Math.max(1, target * 0.01)) {
    add('warning', 'Invoices add up to more than the agreed price', `Invoiced: ${round2(billed)} vs agreed ${round2(target)}. Double-check before sending.`);
  }
  for (const f of (c.ai?.summary?.flags || []).filter((x) => x.severity === 'high')) add('warning', `Risky clause still open: ${f.clause}`.slice(0, 120), f.suggestion || f.why_it_matters);
  if (!biz.name && !biz.business_name) add('warning', 'Your own business details are empty', 'Add your name and payment details in Settings so invoices show who to pay.');
  if (!checks.length) add('ok', 'Basic details look complete', 'Client, scope, price, payment terms and deadline are all filled in.');
  return checks;
}

// 6. Pre-submission checklist + final summary
r.post('/checklist', async (req, res) => {
  const c = needContract(req.body?.contract_id);
  const auto = autoChecks(c);
  const invoices = c.invoices.map((i) => ({ number: i.number, type: i.type, status: i.display_status, total: i.total, currency: i.currency, due: i.due_date }));
  let result;
  try {
    const out = await chat(prompts.checklist({ contract: c, autoChecks: auto, invoices }), { validate: jsonValidator(['items']) });
    result = { items: [...auto, ...(out.parsed.items || []).map((x) => ({ ...x, source: 'ai' }))], final_summary: out.parsed.final_summary || '', ...stamp(out) };
  } catch (e) {
    if (!(e instanceof AIError)) throw e;
    // AI unavailable: still return the automatic checks so the user is not blocked.
    result = { items: auto, final_summary: '', ai_error: e.message, attempts: e.attempts, at: new Date().toISOString() };
  }
  saveAI(c.id, 'checklist', result);
  if (result.final_summary) db.prepare('UPDATE contracts SET final_summary = ? WHERE id = ?').run(result.final_summary, c.id);
  res.json(result);
});

// Dashboard: payment reminder / follow-up email
r.post('/reminder', async (req, res) => {
  const { invoice_id, contract_id, tone = 'friendly' } = req.body || {};
  if (contract_id && !invoice_id) {
    const c = needContract(contract_id);
    const out = await chat(prompts.scripts({ contract: c, scenario: 'Polite follow-up: the client has gone quiet during negotiation', notes: '' }), { validate: jsonValidator(['emails']) });
    const e = out.parsed.emails.find((x) => x.tone === tone) || out.parsed.emails[0];
    return res.json({ subject: e.subject, body: e.body, to: c.client?.email || '', ...stamp(out) });
  }
  const inv = getInvoice(invoice_id);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  const out = await chat(prompts.reminder({
    invoice: { number: inv.number, total: inv.total, currency: inv.currency, issue_date: inv.issue_date, due_date: inv.due_date, project: inv.contract?.title, payment_instructions: inv.payment_instructions },
    client: inv.client ? { name: inv.client.name, company: inv.client.company } : {}, business: business(), tone, daysOverdue: inv.days_overdue || -Math.max(0, Math.round((new Date(inv.due_date) - new Date()) / 86400000)),
  }), { validate: jsonValidator(['subject', 'body']), temperature: 0.5 });
  res.json({ ...out.parsed, to: inv.client?.email || '', ...stamp(out) });
});

// "Ask AI" help on any step
r.post('/ask', async (req, res) => {
  const { contract_id, step, question } = req.body || {};
  if (!String(question || '').trim()) return res.status(400).json({ error: 'Type a question first.' });
  const c = contract_id ? getContract(contract_id) : null;
  const out = await chat(prompts.ask({ step, question: String(question).slice(0, 2000), contract: c }), { temperature: 0.4 });
  res.json({ answer: out.content, ...stamp(out) });
});

export default r;
