# Snapdeal AI Virtual KAM

A standalone voice-first seller success assistant that diagnoses sales decline, explains likely drivers, recommends prioritized actions, captures seller-approved commitments, and supports follow-up.

## Stack

React and Vite power the seller workspace. Node.js and Express expose the API. MongoDB and Mongoose persist seller snapshots, conversations, and commitments. LangChain JS orchestrates the conversational agent with structured output. Google Gemini is used when configured. Browser SpeechRecognition and SpeechSynthesis provide voice.

## Run locally

Requirements: Node.js 20+ and MongoDB 7+ or MongoDB Atlas.

1. Run `npm install`.
2. Copy `.env.example` to `.env`.
3. Set `MONGODB_URI` and optionally `GEMINI_API_KEY`.
4. Run `npm run dev`.
5. Open `http://localhost:5173`.

Without a Gemini key, deterministic KPI analysis and a limited dialogue fallback remain available.

## Demo flow

Open the UrbanNest Home dashboard, press Talk, report the sales decline, answer the agent's focused question, request a seven-day plan, and review the prioritized actions and commitment workflow.

## API

- `GET /api/health`
- `GET /api/sellers`
- `GET /api/sellers/:id/analysis`
- `POST /api/conversations`
- `POST /api/conversations/:id/turn`
- `GET /api/sellers/:id/commitments`

The seller dataset is synthetic. The prototype is not connected to Snapdeal production systems and does not execute marketplace changes. See `TECH_NOTE.md` and `DEMO_SCRIPT.md`.
