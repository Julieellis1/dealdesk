// Prompt builders. Every answer must stay beginner-friendly: plain words, jargon explained in brackets.
const BASE = `You are DealDesk Coach, a patient, practical guide for a freelancer or small service provider who is a complete beginner at contracts, negotiation and invoicing.
Rules:
- Use plain, everyday English and short sentences. If you must use a business or legal term, explain it in a few words in brackets the first time, e.g. "Net 30 (the client pays within 30 days of the invoice)".
- Be concrete: real numbers, real wording the user can copy.
- Be honest about risk, but calm and encouraging.
- You are not a lawyer and this is not legal advice. For high-stakes or unclear legal points, suggest asking a qualified professional.`;

const JSON_RULE = 'Reply with ONLY a valid JSON object, no markdown fences, no extra text.';

export function contractContext(c, extra = {}) {
  const ctx = {
    title: c.title,
    status: c.status,
    terms: c.terms,
    job: c.job,
    pricing: c.pricing,
    client: c.client ? { name: c.client.name, company: c.client.company, payment_method: c.client.payment_method } : null,
    negotiation_rounds: (c.rounds || []).map((r) => ({ date: r.round_date, by: r.party, kind: r.kind, amount: r.amount, notes: r.notes })),
    contract_text_excerpt: (c.contract_text || '').slice(0, 12000),
    ...extra,
  };
  return JSON.stringify(ctx, null, 1);
}

export const prompts = {
  summarize: ({ text, terms }) => [
    { role: 'system', content: `${BASE}\n${JSON_RULE}` },
    { role: 'user', content: `Read this contract (or these terms) and explain it to a beginner.

Return JSON with exactly these keys:
{
 "plain_summary": "4-8 short sentences in plain English: who does what, for how much, by when, and what happens if things go wrong",
 "key_terms": { "title": "", "scope": "", "payment_terms": "", "deadlines": "", "penalties": "", "termination": "", "ip_ownership": "" },
 "flags": [ { "severity": "high|medium|low", "clause": "short quote or name of the clause", "why_it_matters": "plain explanation of the risk", "suggestion": "what to ask for instead, with example wording" } ],
 "questions_to_ask": [ "questions the user should ask the client before agreeing" ]
}
key_terms: fill each with what the contract actually says, or "" if it says nothing. Flag anything risky or unusual: unlimited revisions, vague scope, payment only on final delivery, long payment terms (over 30 days), big penalties, one-sided termination, ownership transferring before payment, unlimited liability, non-compete, missing late-fee or kill-fee protection. Also flag important things that are MISSING.

Manually entered terms: ${JSON.stringify(terms || {})}

Contract text:
"""
${String(text || '').slice(0, 24000) || '(no text provided, use the manual terms)'}
"""` },
  ],

  pricing: ({ contract, context }) => [
    { role: 'system', content: `${BASE}\n${JSON_RULE}` },
    { role: 'user', content: `Suggest a fair price and payment structure for this job, and strategies to negotiate it.
The user's own context: ${JSON.stringify(context || {})}

Return JSON:
{
 "currency": "3-letter code",
 "price_basis": "total|per hour|per month",
 "low": number, "fair": number, "high": number,
 "rationale": "plain explanation of how you got these numbers and what moves the price up or down",
 "payment_structure": {
   "recommended": "short name, e.g. 50% deposit + 50% on delivery",
   "deposit_percent": number,
   "milestones": [ { "name": "", "percent": number } ],
   "net_days": number,
   "explanation": "why this protects the user, explaining deposit / milestones / net terms in plain words"
 },
 "strategies": [ { "name": "", "how": "what to do", "example": "a sentence the user could actually say or write" } ]
}
Give 4-6 strategies (e.g. anchor high, trade not cave, offer packages/options, ask about budget first, protect scope, walk-away point). Use the currency in the job details if given. Prices must be realistic for the market described; if information is thin, say so in the rationale.

Contract and job:
${contractContext(contract)}` },
  ],

  scripts: ({ contract, scenario, notes }) => [
    { role: 'system', content: `${BASE}\n${JSON_RULE}` },
    { role: 'user', content: `Write ready-to-send negotiation emails for this situation: "${scenario}".
Extra notes from the user: ${notes || '(none)'}

Return JSON:
{ "emails": [
   { "tone": "friendly", "subject": "", "body": "" },
   { "tone": "firm", "subject": "", "body": "" },
   { "tone": "formal", "subject": "", "body": "" }
 ],
 "tips": [ "2-3 short tips for sending this, e.g. timing, what not to say" ] }
Bodies: complete emails with greeting and sign-off, using the real names, amounts and dates from the data. Use [placeholders] only for info that is truly missing. Keep each under 200 words. Friendly = warm and relaxed; firm = polite but clear about non-negotiables; formal = professional and neutral.

Contract data:
${contractContext(contract)}` },
  ],

  objections: ({ contract }) => [
    { role: 'system', content: `${BASE}\n${JSON_RULE}` },
    { role: 'user', content: `Role-play the client. List the 5 objections this client is most likely to raise about price, timeline, payment terms or scope, and coach the user on how to answer each.
Return JSON:
{ "objections": [ { "objection": "what the client might say, in their voice", "response": "what the user can say back, word for word", "why_it_works": "one plain sentence" } ] }

Contract data:
${contractContext(contract)}` },
  ],

  roleplay: ({ contract, history }) => [
    { role: 'system', content: `${BASE}
You are running a negotiation practice session. Play the CLIENT in this deal: realistic, a bit price-sensitive, polite but pushing for a better deal. After each user message, reply as the client, then give the user one short coaching tip on their last message.
${JSON_RULE} Format: { "client_reply": "", "coach_tip": "" }

Deal data:
${contractContext(contract)}` },
    ...(history || []).map((h) => ({ role: h.role === 'client' ? 'assistant' : 'user', content: h.role === 'client' ? JSON.stringify({ client_reply: h.text, coach_tip: '' }) : h.text })),
  ],

  checklist: ({ contract, autoChecks, invoices }) => [
    { role: 'system', content: `${BASE}\n${JSON_RULE}` },
    { role: 'user', content: `Run a final pre-submission review before the user signs or submits this contract.
Automatic checks already found: ${JSON.stringify(autoChecks)}
Invoices created: ${JSON.stringify(invoices)}

Look for: missing information, inconsistencies (e.g. invoice amounts vs agreed price, dates vs deadlines, payment terms in contract vs invoices), unclear clauses, and unaddressed risks.
Return JSON:
{
 "items": [ { "status": "ok|warning|missing", "title": "short", "detail": "plain explanation and what to do" } ],
 "final_summary": "Markdown. A one-page plain-English summary of the final deal: parties, scope, price and payment schedule, deadlines, key protections, open risks, and next steps."
}
Do not repeat the automatic checks word for word; add what they miss. 4-10 items.

Contract data:
${contractContext(contract)}` },
  ],

  reminder: ({ invoice, client, business, tone, daysOverdue }) => [
    { role: 'system', content: `${BASE}\n${JSON_RULE}` },
    { role: 'user', content: `Write a ${tone} payment reminder email for an invoice that is ${daysOverdue > 0 ? `${daysOverdue} days overdue` : daysOverdue === 0 ? 'due today' : `due in ${-daysOverdue} days`}.
Friendly = warm nudge assuming it was missed; firm = clear, mentions next steps; final = last notice, mentions possible late fees or pausing work, still professional.
Return JSON: { "subject": "", "body": "" }
Invoice: ${JSON.stringify(invoice)}
Client: ${JSON.stringify(client || {})}
Sender (the user): ${JSON.stringify({ name: business.name, business_name: business.business_name, email: business.email })}` },
  ],

  ask: ({ step, question, contract }) => [
    { role: 'system', content: `${BASE}\nAnswer in short Markdown (under 250 words unless the user asks for more). Use bullet points where they help.` },
    { role: 'user', content: `I'm on this step of the app: "${step || 'general'}".
${contract ? `My deal so far:\n${contractContext(contract)}\n` : ''}
My question: ${question}` },
  ],
};
