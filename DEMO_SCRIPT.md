# 90-second assignment demo script

## Before recording

- Start MongoDB and the app using the steps in `README.md`.
- Open the app in Chrome or Edge at `http://localhost:5173`.
- Allow microphone access and keep the browser tab visible.
- Make sure the UrbanNest Home dashboard, diagnosis and recovery actions are visible.
- Use the demo phrases below so the evaluator sees the full ownership loop.

## Timed walkthrough

**0:00–0:12 — Context and evidence**

Show the seller dashboard. Say: “This is a voice-first Mini Virtual KAM. It compares the seller's last 30 days, identifies the drivers of the decline and turns them into an accountable recovery plan.” Point out revenue down 31.9%, visits down 15%, conversion down 0.60 percentage points, stock availability at 82% and cancellations at 7%.

**0:12–0:30 — Voice diagnosis**

Press **Talk to KAM** and say:

> My sales have dropped. Can you help me understand why?

Let the KAM explain the traffic and conversion movement and ask its focused stock/fulfilment question.

**0:30–0:45 — Seller clarification**

Say:

> My Kitchen Storage Rack is out of stock, and I have also had more cancellations.

Show the SKU evidence and explain why the KAM prioritizes availability and cancellations before advertising or discounts.

**0:45–1:02 — Action plan**

Say:

> What should I do over the next seven days?

Show the ranked actions. Briefly explain the first step, owner, timeline and success measure.

**1:02–1:18 — Explicit commitment**

Say:

> I will restock the Kitchen Storage Rack by tomorrow.

Show the saved seller commitment and due date in the accountability panel. Explain that the system records the action only after the seller explicitly agrees and supplies a due date.

**1:18–1:30 — Follow-up ownership**

Press **Check in** on the commitment. Show the follow-up prompt added to the conversation. Mention that the prototype supports in-app check-ins; production reminders would require a scheduled notification service.

## Closing narration

“The agent uses LangChain and Gemini for conversational understanding, deterministic backend logic for reliable seller metrics, MongoDB for conversation and commitment persistence, and browser speech APIs for voice input and output. It does not pretend to change marketplace data; it keeps the seller in control of operational actions.”

## Recording checklist

- Keep the recording between 1 and 2 minutes.
- Show at least one real microphone interaction, not only typed messages.
- Show the diagnosis, one clarification, prioritized recommendations, a saved commitment and a follow-up check-in.
- Keep the synthetic-data and prototype disclaimer visible or mention it in the narration.
- Do not show API keys, `.env`, credentials or personal account data.
