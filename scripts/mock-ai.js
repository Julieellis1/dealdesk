// A tiny fake OpenAI-compatible server for trying DealDesk without an API key.
//   npm run mock-ai
// Then in Settings → AI Models add:  Base URL http://127.0.0.1:4010/v1   Model mock-coach   (any API key)
// Base URL http://127.0.0.1:4010/fail/v1 always answers "429 rate limited", handy for testing fallback.
import http from 'node:http';

const PORT = Number(process.env.MOCK_PORT || 4010);

function answer(prompt) {
  const p = prompt.toLowerCase();
  if (p.includes('reply with the single word')) return 'OK';
  if (p.includes('"plain_summary"')) return JSON.stringify({
    plain_summary: 'You will design and build a 5-page website for the client. They pay a fixed fee, but only after the final delivery, and they can ask for unlimited changes. Either side can end the deal, but the client can cancel at any time without paying for work already done. The client owns everything as soon as it is created.',
    key_terms: { title: 'Website design agreement', scope: '5-page marketing website', payment_terms: 'Full payment 60 days after final delivery', deadlines: 'Launch within 6 weeks', penalties: '5% fee reduction per week of delay', termination: 'Client may terminate at any time', ip_ownership: 'Client owns all work on creation' },
    flags: [
      { severity: 'high', clause: 'Payment 60 days after final delivery', why_it_matters: 'You do all the work before seeing any money, then wait two more months.', suggestion: 'Ask for a 50% deposit and Net 14 (payment within 14 days) on the rest.' },
      { severity: 'high', clause: 'Unlimited revisions', why_it_matters: 'The job could go on forever for the same price ("scope creep").', suggestion: 'Limit to 2 rounds of revisions; extra rounds billed at your hourly rate.' },
      { severity: 'medium', clause: 'Ownership on creation', why_it_matters: 'They own the work even if they never pay.', suggestion: '"Ownership transfers once full payment is received."' },
      { severity: 'low', clause: 'No late-payment fee (missing)', why_it_matters: 'Nothing encourages on-time payment.', suggestion: 'Add a small late fee, e.g. 1.5% per month on overdue amounts.' },
    ],
    questions_to_ask: ['What is your budget range for this project?', 'Who gives final approval on designs?', 'Can we agree on a deposit before I start?'],
  });
  if (p.includes('suggest a fair price')) return JSON.stringify({
    currency: 'USD', price_basis: 'total', low: 1800, fair: 2400, high: 3200,
    rationale: 'A 5-page site with simple design typically takes 40-60 hours. At $40-55/hour for an early-career freelancer that gives roughly $1,800-$3,200. Rush timelines, extra pages, or copywriting push the price up.',
    payment_structure: { recommended: '50% deposit + 50% on delivery', deposit_percent: 50, milestones: [{ name: 'Deposit', percent: 50 }, { name: 'Launch', percent: 50 }], net_days: 14, explanation: 'A deposit (money paid before you start) proves the client is serious and covers your time if they disappear. Net 14 means the final payment is due within 14 days of your invoice.' },
    strategies: [
      { name: 'Anchor first', how: 'State your price before asking theirs, slightly above your target.', example: 'For this scope my fee is $2,800.' },
      { name: 'Trade, don\'t cave', how: 'If they push back, lower scope, not just price.', example: 'I can do $2,200 if we go with 4 pages instead of 5.' },
      { name: 'Offer options', how: 'Give a basic and a premium package.', example: 'Option A is $2,200, option B with copywriting is $3,000.' },
      { name: 'Know your walk-away', how: 'Decide the lowest price you will accept before the call.', example: 'Below $1,800 I would need to decline politely.' },
    ],
  });
  if (p.includes('negotiation emails')) {
    const mk = (tone, s) => ({ tone, subject: 'Website project: proposal and next steps', body: `${s}\n\nThank you for sharing the details of the website project. Based on the scope (5 pages, 2 rounds of revisions, launch in 6 weeks), my fee is $2,400.\n\nTo get started I ask for a 50% deposit, with the balance due within 14 days of launch.\n\nHappy to walk through this on a quick call.\n\nBest regards,\n[Your name]` });
    return JSON.stringify({ emails: [mk('friendly', 'Hi there!'), mk('firm', 'Hello,'), mk('formal', 'Dear Client,')], tips: ['Send it on a weekday morning.', 'Don\'t apologise for your price.'] });
  }
  if (p.includes('role-play the client. list')) return JSON.stringify({ objections: [
    { objection: 'That\'s more than we budgeted.', response: 'I understand. What budget did you have in mind? We could adjust the scope to fit.', why_it_works: 'It keeps your rate intact and moves the talk to scope.' },
    { objection: 'Can we skip the deposit?', response: 'The deposit reserves your slot in my schedule and is standard for new clients. I can reduce it to 30%.', why_it_works: 'You explain the reason and offer a small, safe concession.' },
    { objection: 'Another freelancer quoted less.', response: 'That\'s fair to compare. My quote includes two revision rounds and launch support, which saves you time later.', why_it_works: 'You compete on value, not price.' },
  ] });
  if (p.includes('negotiation practice')) return JSON.stringify({ client_reply: 'Hmm, $2,400 feels high for us. Could you do $1,800?', coach_tip: 'Don\'t answer with a new price straight away. Ask what is driving their budget first.' });
  if (p.includes('pre-submission review')) return JSON.stringify({
    items: [{ status: 'ok', title: 'Payment schedule matches invoices', detail: 'The deposit and final invoices add up to the agreed price.' }, { status: 'warning', title: 'Revisions clause still unlimited in the contract text', detail: 'Make sure the signed version says "2 rounds of revisions".' }],
    final_summary: '## Final deal\n- **Client:** Example Co.\n- **Scope:** 5-page website, 2 revision rounds\n- **Price:** $2,400 (50% deposit, 50% Net 14)\n- **Deadline:** 6 weeks from deposit\n\n**Next steps:** send the deposit invoice and sign the updated contract.',
  });
  if (p.includes('payment reminder')) return JSON.stringify({ subject: 'Friendly reminder: invoice payment', body: 'Hi,\n\nI hope you\'re well. This is a quick reminder that the invoice below is now due. You\'ll find the payment details on the invoice.\n\nPlease let me know if anything is unclear.\n\nThanks!\n[Your name]' });
  return '**Short answer:** a deposit is money the client pays *before* you start, usually 30-50%. It protects you if the client disappears.\n\n- Ask for it in your first proposal\n- Send a deposit invoice right after agreeing\n\n_This is the mock model: connect a real model in Settings → AI Models for real answers._';
}

http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    if (req.url.startsWith('/fail')) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: { message: 'Rate limit reached (mock)' } }));
    }
    if (!req.url.endsWith('/chat/completions')) { res.writeHead(404); return res.end(); }
    const { messages = [], model } = JSON.parse(body || '{}');
    const prompt = messages.map((m) => m.content).join('\n');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id: 'mock', object: 'chat.completion', model, choices: [{ index: 0, message: { role: 'assistant', content: answer(prompt) }, finish_reason: 'stop' }] }));
  });
}).listen(PORT, '127.0.0.1', () => console.log(`Mock AI listening on http://127.0.0.1:${PORT}/v1 (and /fail/v1 for a failing one)`));
