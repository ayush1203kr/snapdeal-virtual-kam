# AI and Voice Technology Note

LangChain JS orchestrates the seller conversation using a prompt chain and structured output. The agent receives recent conversation history, seller profile, deterministic KPI diagnosis, and prioritized actions. Its response includes a concise spoken reply, intent, and optional follow-up question.

Google Gemini is integrated through the LangChain Google Generative AI package. It handles conversational understanding and phrasing, not financial calculations. Revenue, order, traffic, conversion changes, health score, and recommendation triggers are computed in backend code to keep results reproducible.

Voice uses the browser Web Speech API. SpeechRecognition captures English (India) seller input; SpeechSynthesis reads the response aloud. Text input remains available if microphone permission is denied or speech recognition is unsupported.

MongoDB stores seller profiles, product snapshots, conversations, and seller-approved commitments. The UrbanNest Home dataset is synthetic.

Agent ownership loop: inspect seller metrics, diagnose likely causes, ask a targeted clarification, prioritize actions, obtain explicit seller agreement, and record the agreed task and due date. The prototype does not claim to modify marketplace listings, prices, ads, or inventory and does not send actual reminders.

Production deployment would require authenticated seller identity, authorization, real marketplace integrations, audit logs, scheduled follow-up jobs, notification delivery, monitoring, and privacy controls. This demo is not connected to Snapdeal production services.
