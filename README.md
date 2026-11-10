# Snapdeal AI Virtual KAM

A standalone, voice-first Mini AI Virtual Key Account Manager (KAM) prototype for a marketplace seller whose sales have declined. It turns seller metrics into an evidence-led diagnosis, asks focused questions, builds a prioritized recovery plan, records seller-approved commitments and supports a follow-up check-in.

> **Prototype disclaimer:** This is an independent take-home concept demo. It is not an official Snapdeal product, is not connected to Snapdeal production systems, and uses synthetic seller data. It does not change listings, inventory, prices, advertising, orders or seller account settings.

## Assignment outcomes covered

| Assignment expectation | How the prototype demonstrates it |
| --- | --- |
| Voice-first experience | Browser speech recognition (`en-IN`) captures the seller's voice; speech synthesis speaks the KAM response. Text remains available as an accessibility and compatibility fallback. |
| Understand a sales decline | The backend compares the previous and current 30-day seller snapshots and separates traffic, conversion, average order value, stock, cancellation, rating and return signals. |
| Ask relevant questions | The agent asks one focused question at a time, selected from the strongest unresolved operational risk. |
| Give actionable recommendations | Recommendations include priority, business impact, first step, owner, timeline and a measurable success metric. |
| Demonstrate agentic ownership | The KAM moves through diagnose → clarify → recommend → obtain seller commitment → follow up. |
| Remember commitments | Seller-approved actions and due dates are stored in MongoDB and shown in the accountability panel. |
| Follow up | The seller can trigger a check-in from the commitment panel; the KAM adds the check-in to the conversation. The prototype does not send background notifications. |
| Explain the AI/voice choices | `TECH_NOTE.md` describes the architecture, guardrails, metric logic, voice layer and limitations. |
| Provide a short demo walkthrough | `DEMO_SCRIPT.md` contains a timed walkthrough and suggested spoken inputs. |

## Product walkthrough

1. The seller workspace opens with a 30-day performance snapshot.
2. The KAM explains the largest measurable drivers of the decline.
3. The seller shares operational context using the microphone or text box.
4. The KAM narrows the issue with a targeted question and presents a ranked recovery plan.
5. The seller explicitly agrees to an action and due date, for example: `I will restock the Kitchen Storage Rack by tomorrow.`
6. The commitment is persisted and appears in the accountability panel.
7. The seller can check in, mark the action complete or flag a blocker. The follow-up prompt is appended to the active conversation.

## Technology

- **Frontend:** React 18, Vite, responsive CSS
- **Backend:** Node.js 20+, Express 4, TypeScript via `tsx`
- **Persistence:** MongoDB 7+ and Mongoose
- **Agent orchestration:** LangChain JS with structured output
- **LLM:** Google Gemini (`gemini-2.5-flash`) when an API key is configured
- **Voice:** Browser Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition` and `SpeechSynthesis`)
- **Validation:** Zod response schema and deterministic commitment extraction
- **Tests:** Node test runner with `tsx`

## Run locally

### Prerequisites

- Node.js 20 or later
- MongoDB 7+ running locally, or a MongoDB Atlas connection string
- A modern Chromium browser (Chrome or Edge recommended) for microphone input
- Optional: Google Gemini API key for LLM-powered dialogue

### Setup

```bash
npm install
```

Copy `.env.example` to `.env` and configure the database. On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Example `.env` values:

```dotenv
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017/snapdeal_virtual_kam
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
CLIENT_ORIGIN=http://localhost:5173
```

Start the API and Vite development server together:

```bash
npm run dev
```

Open `http://localhost:5173` and allow microphone access. The backend seeds the synthetic UrbanNest Home seller the first time it connects to MongoDB.

If you do not configure `GEMINI_API_KEY`, the deterministic dialogue fallback remains available. KPI calculations and commitment validation are deterministic in either mode. The fallback is intentionally narrower than the LLM-powered conversation.

### Useful commands

```bash
npm test
npm run build
npm run seed
npm start
```

`npm start` serves the API and the built frontend when `NODE_ENV=production` and `dist/` exists. Configure `MONGODB_URI` before starting the backend.

## Demo seller and diagnosis

The UrbanNest Home account is fictional. The two 30-day snapshots are deliberately constructed to make the diagnosis explainable:

| Metric | Previous 30 days | Current 30 days | Interpretation |
| --- | ---: | ---: | --- |
| Revenue | ₹4,32,000 | ₹2,94,000 | Down 31.9% |
| Orders | 360 | 245 | Down 31.9% |
| Visits | 12,000 | 10,200 | Down 15.0% |
| Conversion | 3.00% | 2.40% | Down 0.60 percentage points; 19.8% relative decline |
| Average order value | ₹1,200 | ₹1,200 | Flat |
| Catalogue in stock | 96% | 82% | Availability risk |
| Cancellation rate | 3% | 7% | Elevated |
| Average rating | 4.2 | 3.9 | Needs attention |
| Return rate | 5% | 8% | Needs attention |

The sample SKU `Kitchen Storage Rack` has zero stock and high recorded views. `Foldable Laundry Basket` has limited stock. The recovery sequence therefore protects availability and fulfilment first, then works on qualified traffic, conversion friction and customer experience. It deliberately avoids sending more traffic to unavailable products or recommending blanket discounts before the underlying issues are checked.

## API surface

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Service health |
| GET | `/api/sellers` | Demo seller list |
| GET | `/api/sellers/:id/analysis` | Deterministic KPI analysis and recovery actions |
| POST | `/api/conversations` | Start a seller conversation (`{ "sellerId": "..." }`) |
| POST | `/api/conversations/:id/turn` | Send a seller message and receive an agent response |
| GET | `/api/sellers/:id/commitments` | List seller commitments and follow-up dates |
| PATCH | `/api/commitments/:id` | Update commitment status (`open`, `completed`, `blocked`) |
| POST | `/api/commitments/:id/check-in` | Append a follow-up prompt to the conversation |

## Project structure

```text
client/
  src/
    App.jsx
    api.js
    useVoice.js
    styles.css
  vite.config.js
server/
  src/
    agent/
      commitmentParser.ts
      virtualKam.ts
    models/
      models.ts
    routes/
      api.ts
    seed/
      seed.ts
      seedData.ts
    services/
      diagnostics.ts
    index.ts
  test/
    commitmentParser.test.ts
    diagnostics.test.ts
TECH_NOTE.md
DEMO_SCRIPT.md
```

## Publish to the standalone GitHub repository

After extracting the ZIP, open PowerShell in the extracted `snapdeal-virtual-kam` folder and run:

```powershell
powershell -ExecutionPolicy Bypass -File .\PUSH_TO_GITHUB.ps1
```

The script clones or updates `ayush1203kr/snapdeal-virtual-kam`, copies the project files without copying local secrets or build artifacts, commits the changes and pushes to `main`. GitHub authentication must be available through Git Credential Manager.

## Current boundaries

- Seller and SKU metrics are synthetic, not live marketplace data.
- Gemini is optional; without it, a deterministic fallback supports the key demo flow.
- Browser voice support and microphone permission depend on the browser and a secure context. Localhost is treated as secure by modern browsers; deployed demos should use HTTPS.
- Follow-up check-ins are initiated in the UI. There is no background scheduler, email, WhatsApp or push notification service.
- Commitment capture requires an explicit seller action and a clear future due date. A model-generated suggestion alone cannot create a commitment.
- Real execution would require authenticated seller identity, scoped authorization, official marketplace API access, idempotent action workflows, audit trails, monitoring, privacy controls and human approval for consequential changes.

See `TECH_NOTE.md` for design decisions and `DEMO_SCRIPT.md` for the recording walkthrough.
