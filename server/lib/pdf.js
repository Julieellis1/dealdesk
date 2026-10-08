import PDFDocument from 'pdfkit';
import { fmtMoney } from './money.js';

const TYPE_LABEL = { single: 'Invoice', deposit: 'Deposit invoice', milestone: 'Milestone invoice', recurring: 'Recurring invoice' };

export function invoicePdf(inv, biz) {
  const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Invoice ${inv.number}` } });
  const cur = inv.currency;
  const W = doc.page.width - 100;
  const ink = '#111827', muted = '#6b7280', accent = '#4f46e5';

  // Header
  doc.fillColor(accent).fontSize(24).font('Helvetica-Bold').text(TYPE_LABEL[inv.type] || 'Invoice', 50, 50);
  doc.fillColor(muted).fontSize(10).font('Helvetica').text(inv.number, 50, 80);
  const from = [biz.business_name || biz.name, biz.business_name && biz.name ? biz.name : '', biz.address, biz.email, biz.phone, biz.tax_id ? `Tax ID: ${biz.tax_id}` : '']
    .filter(Boolean).join('\n');
  doc.fillColor(ink).fontSize(10).text(from || 'Your business details (add them in Settings)', 300, 50, { width: W - 250, align: 'right' });

  // Bill to + dates
  let y = 150;
  doc.fillColor(muted).fontSize(9).text('BILL TO', 50, y);
  const c = inv.client || {};
  const to = [c.company, c.name, c.address, c.email, c.tax_id ? `Tax ID: ${c.tax_id}` : ''].filter(Boolean).join('\n') || '—';
  doc.fillColor(ink).fontSize(10).text(to, 50, y + 14, { width: 240 });
  const meta = [['Issue date', inv.issue_date], ['Due date', inv.due_date], ['Currency', cur]];
  if (inv.contract?.title) meta.push(['Project', inv.contract.title]);
  meta.forEach(([k, v], i) => {
    doc.fillColor(muted).fontSize(9).text(k, 330, y + i * 16, { width: 90 });
    doc.fillColor(ink).fontSize(10).text(String(v), 420, y + i * 16, { width: W - 370, align: 'right' });
  });

  // Items table
  y = Math.max(doc.y, y + meta.length * 16) + 30;
  const cols = [50, 330, 400, 480];
  doc.rect(50, y, W, 22).fill('#f3f4f6');
  doc.fillColor(muted).fontSize(9).font('Helvetica-Bold');
  doc.text('DESCRIPTION', cols[0] + 8, y + 7);
  doc.text('QTY', cols[1], y + 7, { width: 60, align: 'right' });
  doc.text('UNIT PRICE', cols[2], y + 7, { width: 75, align: 'right' });
  doc.text('AMOUNT', cols[3], y + 7, { width: W - 438, align: 'right' });
  y += 30;
  doc.font('Helvetica').fillColor(ink).fontSize(10);
  for (const it of inv.items) {
    const amount = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
    const h = Math.max(doc.heightOfString(it.description || '', { width: 270 }), 12);
    if (y + h > doc.page.height - 160) { doc.addPage(); y = 50; }
    doc.text(it.description || '', cols[0] + 8, y, { width: 270 });
    doc.text(String(it.quantity ?? ''), cols[1], y, { width: 60, align: 'right' });
    doc.text(fmtMoney(it.unit_price, '').trim(), cols[2], y, { width: 75, align: 'right' });
    doc.text(fmtMoney(amount, '').trim(), cols[3], y, { width: W - 438, align: 'right' });
    y += h + 10;
    doc.moveTo(50, y - 5).lineTo(50 + W, y - 5).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
  }

  // Totals
  y += 8;
  const rows = [['Subtotal', inv.subtotal]];
  if (inv.discount) rows.push(['Discount', -inv.discount]);
  if (inv.tax_rate) rows.push([`Tax (${inv.tax_rate}%)`, inv.tax]);
  rows.forEach(([k, v]) => {
    doc.fillColor(muted).fontSize(10).text(k, 330, y, { width: 120 });
    doc.fillColor(ink).text(fmtMoney(v, cur), 420, y, { width: W - 370, align: 'right' });
    y += 18;
  });
  doc.rect(330, y, W - 280, 28).fill(accent);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(12).text('Total due', 340, y + 8);
  doc.text(fmtMoney(inv.total, cur), 420, y + 8, { width: W - 380, align: 'right' });
  y += 50;

  // Payment + notes
  doc.font('Helvetica');
  const pay = inv.payment_instructions || biz.payment_details;
  if (pay) {
    if (y > doc.page.height - 140) { doc.addPage(); y = 50; }
    doc.fillColor(muted).fontSize(9).text('HOW TO PAY', 50, y);
    doc.fillColor(ink).fontSize(10).text(pay, 50, y + 14, { width: W });
    y = doc.y + 16;
  }
  if (inv.notes) {
    if (y > doc.page.height - 120) { doc.addPage(); y = 50; }
    doc.fillColor(muted).fontSize(9).text('NOTES', 50, y);
    doc.fillColor(ink).fontSize(10).text(inv.notes, 50, y + 14, { width: W });
  }
  doc.fillColor(muted).fontSize(8).text(`Please quote ${inv.number} with your payment. Thank you!`, 50, doc.page.height - 70, { width: W, align: 'center' });
  doc.end();
  return doc;
}

export function pdfToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}
