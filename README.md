# DealDesk: AI contract, negotiation & invoicing coach

A guided web app for freelancers and service providers who are new to contracts, negotiation and invoicing.
Press **“I have a new contract”** and it walks you through six steps, with a plain-English *Why this matters*
box and an **Ask AI** button on every one:

1. **Contract**: upload (PDF/DOCX/TXT), paste, or type the terms. AI explains it in plain English, flags risky or missing clauses, and fills empty fields.
2. **Client**: name, company, contact, address, tax ID, payment method. Saved and reusable.
3. **Job**: deliverables, dates, milestones, fixed price or hourly rate, expenses.
4. **Price & negotiate**: fair price range, payment structure (deposit / milestones / net terms), strategies, ready-to-send emails in friendly / firm / formal tones, likely client objections with answers, a live practice chat where the AI plays the client, a negotiation log, and the agreed terms.
5. **Invoices**: one click to create single, deposit, milestone or recurring invoices from the agreed terms; edit line items, tax, discount, currency, dates; download PDF, email it with the PDF attached, or share a read-only link.
6. **Finalize**: automatic + AI pre-submission checklist, one-page final summary, mark as signed and submitted.

The **dashboard** shows contracts by stage (Draft → Negotiating → Agreed → Submitted), invoice status
(Draft / Sent / Paid / Overdue), amounts outstanding and overdue, deadlines in the next 30 days, and
suggested nudges with AI-written payment reminders and follow-ups.

> AI guidance is general information, not legal advice.

---

## Quick start

You need **Node.js 20 or newer** (`node -v`). Then, in this folder:

```bash
npm install
cp .env.example .env        # Windows (PowerShell): copy .env.example .env
npm run build               # builds the web app
npm start                   # → open http://127.0.0.1:3001
```

For development with hot reload (frontend on :5173, API on :3001):

```bash
npm run dev                 # → open http://localhost:5173
```

### Connect an AI model (2 minutes)

1. Open **Settings → AI Models → Add model**.
2. Pick a preset (OpenAI, OpenRouter, Groq, Gemini, DeepSeek, Mistral, Together, Ollama…) or type your own:
   - **Base URL**: the OpenAI-compatible address ending in `/v1` (the app adds `/chat/completions`).
   - **Model**: exactly as your provider names it, e.g. `gpt-4o-mini`.
   - **API key**: stored encrypted on the server. Local models (Ollama, LM Studio) need none.
3. Press **Test connection**.
4. Add more models for backup. Drag (or use ▲▼) to set priority; **1 is tried first**.

**Try it without any API key:** run `npm run mock-ai` in a second terminal, then add the
*Mock (testing)* preset (`http://127.0.0.1:4010/v1`, model `mock-coach`). It returns sample answers for every feature.
`http://127.0.0.1:4010/fail/v1` always returns a 429, which is handy for watching the fallback work.

### Fallback behaviour

Every AI request goes to the highest-priority **enabled** model. On any error (network, HTTP 4xx/5xx,
**429 rate limit**, **timeout** (`AI_TIMEOUT_MS`), empty or unparseable answer) it moves to the next one.
Each AI answer shows a badge: *“Answered by Groq · llama-3.3-70b … after 1 fallback (OpenAI: Rate limited)”*.
If every model fails you get one clear message listing each model and why it failed, plus a link to the settings.

---

## Security & data

- **API keys never reach the browser.** The frontend only calls `/api/*`; the server decrypts the key and calls the provider.
  The settings page receives a masked preview (`sk-••••••••abcd`) only. Leave the key field blank when editing to keep it.
- Keys are encrypted at rest with **AES-256-GCM** using `ENCRYPTION_KEY` (or an auto-generated key in `data/.encryption_key`, created with `0600` permissions).
- Provider error messages are scrubbed of anything that looks like a key before logging or display. No request bodies or keys are logged.
- By default the server listens on `127.0.0.1` only. If you expose it (`HOST=0.0.0.0` or deploy it), set `APP_PASSWORD`.
- Invoice share links use random 144-bit tokens, are read-only, and can be turned off per invoice.
- All data (contracts, clients, invoices, negotiation rounds, AI results, settings) is stored in SQLite at `data/dealdesk.db`.
  **Back up the `data/` folder** to keep everything.

## Using it from your phone

The UI is mobile-friendly. To open it from a phone on the same Wi-Fi: set `HOST=0.0.0.0` and an `APP_PASSWORD`
in `.env`, run `npm run build && npm start`, then visit `http://<your-computer-ip>:3001`.

## Deploying (optional)

Any Node host with a persistent disk works (a small VPS, Render/Railway with a volume, Fly.io with a volume):
`npm install && npm run build && npm start`, with `HOST=0.0.0.0`, `APP_PASSWORD`, `ENCRYPTION_KEY`, `PUBLIC_URL`
set, and `DATA_DIR` pointing to the persistent volume. Put it behind HTTPS.

---

## Project structure

```
server/
  index.js            Express app, security headers, optional password, static hosting
  lib/llm.js          OpenAI-compatible client + priority fallback (timeouts, 429s, bad output)
  lib/prompts.js      Beginner-friendly prompts for every AI feature
  lib/crypto.js       AES-256-GCM key encryption, masking, redaction
  lib/db.js           SQLite schema (better-sqlite3)
  lib/pdf.js          Invoice PDF (pdfkit)
  lib/extract.js      PDF/DOCX/TXT → text
  lib/mail.js         SMTP sending (nodemailer)
  routes/data.js      Clients, contracts, negotiation rounds, invoices, dashboard, settings
  routes/ai.js        summarize, pricing, scripts, objections, roleplay, checklist, reminder, ask
  routes/models.js    AI model CRUD, reorder, test connection
  routes/share.js     Public read-only invoice page + PDF
client/src/
  wizard/             The six-step “I have a new contract” wizard (autosaves; resume any time)
  pages/              Dashboard, Contracts, Invoices, Invoice editor, Clients, Settings, AI Models
  components/         UI kit, glossary tooltips, Ask AI, model badge / error box
scripts/mock-ai.js    Fake OpenAI-compatible server for testing
```

### API overview

| Area | Endpoints |
|---|---|
| Contracts | `GET/POST /api/contracts`, `GET/PUT/DELETE /api/contracts/:id`, `POST /api/extract` (file upload) |
| Negotiation | `POST /api/contracts/:id/rounds`, `DELETE /api/rounds/:id` |
| Invoices | `GET/POST /api/invoices`, `GET/PUT/DELETE /api/invoices/:id`, `POST /api/contracts/:id/invoices/generate`, `GET /api/invoices/:id/pdf`, `POST /api/invoices/:id/email`, `POST/DELETE /api/invoices/:id/share`, `POST /api/invoices/:id/next` |
| Clients | `GET/POST /api/clients`, `PUT/DELETE /api/clients/:id` |
| AI | `POST /api/ai/{summarize,pricing,scripts,objections,roleplay,checklist,reminder,ask}` → `{ …result, model, attempts }` |
| AI models | `GET/POST /api/models`, `PUT/DELETE /api/models/:id`, `POST /api/models/reorder`, `POST /api/models/:id/test` |
| Other | `GET /api/dashboard`, `GET/PUT /api/settings/business`, `GET /api/meta` |

## Assumptions

- **Single user**, self-hosted. No multi-account login; `APP_PASSWORD` adds a simple password gate.
- “Overdue” is computed: an invoice marked *Sent* whose due date has passed.
- Recurring invoices are created when you click **Create next invoice** (the dashboard reminds you when one is due), not sent automatically.
- Scanned image-only PDFs have no extractable text. Paste the text or type the terms instead (no OCR).
- Email sending needs SMTP settings; without them, use **Download PDF** + **Open in my email app**.
- PDFs show amounts as `USD 1,240.00` (currency code rather than symbol) so every currency, including ₦, renders correctly with the built-in PDF fonts.
- AI price suggestions depend on the model and the context you give; treat them as a starting point.

## Troubleshooting

- **`npm install` fails on `better-sqlite3`**: Windows, macOS and Linux x64/arm64 usually download a ready-made binary. If yours compiles from source, install build tools first (Windows: “Desktop development with C++” from Visual Studio Build Tools; macOS: `xcode-select --install`; Linux: `sudo apt install build-essential python3`), then run `npm install` again. Use Node 20 or 22 LTS.
- **“No AI model is switched on yet”**: add a model in Settings → AI Models and make sure its toggle is green.
- **Test connection says 401/403**: the API key is wrong or has no credit. 404: check the model name and that the Base URL ends in `/v1`.
- **Port already in use**: change `PORT` in `.env`.
