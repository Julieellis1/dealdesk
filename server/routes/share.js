// Public, read-only invoice page reachable only with an unguessable token.
import { Router } from 'express';
import { db } from '../lib/db.js';
import { getInvoice, business } from '../lib/repo.js';
import { invoicePdf } from '../lib/pdf.js';
import { fmtMoney } from '../lib/money.js';

const r = Router();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const byToken = (t) => {
  const row = db.prepare('SELECT id FROM invoices WHERE share_token = ?').get(t);
  return row ? getInvoice(row.id) : null;
};

r.get('/:token/pdf', (req, res) => {
  const inv = byToken(req.params.token);
  if (!inv) return res.status(404).send('This invoice link is not valid any more.');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${inv.number}.pdf"`);
  invoicePdf(inv, business()).pipe(res);
});

r.get('/:token', (req, res) => {
  const inv = byToken(req.params.token);
  if (!inv) return res.status(404).send('This invoice link is not valid any more.');
  const biz = business();
  const status = inv.display_status === 'paid' ? '<span class="pill paid">Paid</span>' : inv.display_status === 'overdue' ? '<span class="pill over">Overdue</span>' : '';
  const rows = inv.items.map((it) => `<tr><td>${esc(it.description)}</td><td class="n">${esc(it.quantity)}</td><td class="n">${fmtMoney(it.unit_price, '')}</td><td class="n">${fmtMoney(it.quantity * it.unit_price, '')}</td></tr>`).join('');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
  res.setHeader('X-Robots-Tag', 'noindex');
  res.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invoice ${esc(inv.number)}</title><style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f5f7;color:#111827;margin:0;padding:24px}
.card{max-width:760px;margin:auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
h1{margin:0;color:#4f46e5}.muted{color:#6b7280;font-size:14px}.grid{display:flex;flex-wrap:wrap;gap:24px;justify-content:space-between;margin:24px 0}
table{width:100%;border-collapse:collapse;font-size:14px}th{text-align:left;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;padding:8px 4px}
td{padding:10px 4px;border-bottom:1px solid #f1f1f1}.n{text-align:right;white-space:nowrap}.tot{margin-top:16px;text-align:right}
.big{font-size:22px;font-weight:700;color:#4f46e5}.btn{display:inline-block;margin-top:20px;background:#4f46e5;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none}
.pill{font-size:12px;padding:3px 10px;border-radius:99px;margin-left:8px;vertical-align:middle}.paid{background:#dcfce7;color:#166534}.over{background:#fee2e2;color:#991b1b}
pre{white-space:pre-wrap;font-family:inherit;background:#f9fafb;padding:12px;border-radius:8px}</style></head><body><div class="card">
<h1>Invoice ${status}</h1><div class="muted">${esc(inv.number)}</div>
<div class="grid"><div><div class="muted">From</div><b>${esc(biz.business_name || biz.name)}</b><br>${esc(biz.email)}</div>
<div><div class="muted">Bill to</div><b>${esc(inv.client?.company || inv.client?.name || '')}</b><br>${esc(inv.client?.company ? inv.client?.name : '')}</div>
<div><div class="muted">Issued</div>${esc(inv.issue_date)}<div class="muted" style="margin-top:6px">Due</div>${esc(inv.due_date)}</div></div>
<table><thead><tr><th>Description</th><th class="n">Qty</th><th class="n">Unit</th><th class="n">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<div class="tot muted">Subtotal ${fmtMoney(inv.subtotal, inv.currency)}${inv.discount ? `<br>Discount -${fmtMoney(inv.discount, inv.currency)}` : ''}${inv.tax_rate ? `<br>Tax (${inv.tax_rate}%) ${fmtMoney(inv.tax, inv.currency)}` : ''}</div>
<div class="tot big">${fmtMoney(inv.total, inv.currency)}</div>
${inv.payment_instructions || biz.payment_details ? `<h3>How to pay</h3><pre>${esc(inv.payment_instructions || biz.payment_details)}</pre>` : ''}
${inv.notes ? `<h3>Notes</h3><pre>${esc(inv.notes)}</pre>` : ''}
<a class="btn" href="/share/${esc(req.params.token)}/pdf">Download PDF</a></div></body></html>`);
});

export default r;
