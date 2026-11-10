import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";
import { useVoice } from "./useVoice.js";

function Metric({ label, value, change }) {
  const negative = typeof change === "string" && change.startsWith("-");
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small className={negative ? "negative" : "positive"}>{change}</small>
    </article>
  );
}

export default function App() {
  const [seller, setSeller] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [chat, setChat] = useState(null);
  const [commitments, setCommitments] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [provider, setProvider] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const sellers = await api.sellers();
      const selectedSeller = sellers[0];
      if (!selectedSeller) throw new Error("No seller found. Run npm run seed.");
      const [sellerAnalysis, sellerCommitments, conversation] = await Promise.all([
        api.analysis(selectedSeller._id),
        api.commitments(selectedSeller._id),
        api.newChat(selectedSeller._id)
      ]);
      setSeller(selectedSeller);
      setAnalysis(sellerAnalysis);
      setCommitments(sellerCommitments);
      setChat(conversation);
    } catch (requestError) {
      setError(requestError.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const send = useCallback(async message => {
    if (!chat || busy || !message.trim()) return;
    setBusy(true);
    setError("");
    setChat(current => ({
      ...current,
      messages: [...current.messages, { role: "user", content: message, _id: crypto.randomUUID() }]
    }));
    try {
      const result = await api.turn(chat._id, message);
      setChat(result.conversation);
      setAnalysis(result.analysis);
      setProvider(result.provider);
      setCommitments(await api.commitments(seller._id));
      voice.speak(result.reply);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }, [chat, busy, seller]);

  const voice = useVoice(send);

  const submit = event => {
    event.preventDefault();
    const message = draft.trim();
    if (!message) return;
    setDraft("");
    send(message);
  };

  const updateCommitment = async (id, status) => {
    try {
      const updated = await api.updateCommitment(id, status);
      setCommitments(current => current.map(item => item._id === id ? updated : item));
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const checkIn = async id => {
    try {
      const result = await api.checkIn(id);
      if (result.conversation) setChat(result.conversation);
      setCommitments(current => current.map(item => item._id === id ? result.commitment : item));
      voice.speak(result.checkIn);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  if (!seller || !analysis || !chat) {
    return <main className="loading"><h1>Preparing seller workspace</h1><p>{error || "Connecting to the demo workspace…"}</p></main>;
  }

  const openCommitments = commitments.filter(item => item.status !== "completed");

  return (
    <main className="shell">
      <header>
        <div className="brand"><b>S</b><div><strong>snapdeal</strong><small>SELLER GROWTH DESK · CONCEPT DEMO</small></div></div>
        <span className="environment"><i /> DEMO ENVIRONMENT</span>
      </header>

      <section className="welcome">
        <div>
          <small>AI-POWERED SELLER SUCCESS</small>
          <h1>Good morning, {seller.contactName || "Seller"}</h1>
          <p>Let's understand the sales dip, protect your orders and agree on the next action.</p>
        </div>
        <aside><b>{seller.name}</b><span>{seller.category} · {seller.location} · SYNTHETIC DATA</span></aside>
      </section>

      <section className="metrics">
        <Metric label="Revenue · last 30 days" value={money(analysis.current.revenue)} change={analysis.changes.revenueLabel} />
        <Metric label="Orders" value={analysis.current.orders.toLocaleString("en-IN")} change={analysis.changes.ordersLabel} />
        <Metric label="Store visits" value={analysis.current.visits.toLocaleString("en-IN")} change={analysis.changes.visitsLabel} />
        <Metric label="Conversion rate" value={`${analysis.current.conversionRate.toFixed(2)}%`} change={`${analysis.changes.conversionPoints.toFixed(2)} pp vs previous period`} />
      </section>

      <section className="driver-strip">
        <b>What the numbers suggest</b>
        <p>{analysis.driverSummary} Average order value is {money(analysis.current.averageOrderValue)}.</p>
      </section>

      <section className="layout">
        <div className="stack">
          <section className="panel">
            <small>ACCOUNT DIAGNOSIS</small>
            <div className="panelTitle"><h2>What is affecting sales?</h2><div className="score"><b>{analysis.healthScore}</b><span>/100</span></div></div>
            <p className="muted scoreNote">{analysis.healthScoreNote}</p>
            {analysis.signals.length ? analysis.signals.map(signal => (
              <article className="signal" key={signal.key}>
                <div className="signalTitle"><b>{signal.title}</b><span className={`severity ${signal.severity}`}>{signal.severity}</span></div>
                <p>{signal.detail}</p>
              </article>
            )) : <p className="muted">No major negative signals in the supplied snapshot.</p>}
          </section>

          <section className="panel">
            <small>PRIORITIZED RECOVERY PLAN</small>
            <h2>Actions by impact and urgency</h2>
            {analysis.actions.length ? analysis.actions.map((action, index) => (
              <article className="action" key={action.id}>
                <div className="actionHeading"><b>{index + 1}. {action.title}</b><span className={`priority ${action.priority}`}>{action.priority}</span></div>
                <p className="impact">{action.impact}</p>
                <p>{action.firstStep}</p>
                <small>{action.owner} · {action.timeline} · Success: {action.successMetric}</small>
              </article>
            )) : <p className="muted">No urgent action is suggested from this snapshot.</p>}
          </section>

          <section className="panel">
            <small>SKU-LEVEL EVIDENCE</small>
            <h2>Products needing attention</h2>
            {analysis.unavailableProducts.length ? analysis.unavailableProducts.map(product => (
              <article className="productRow" key={product.sku || product.name}>
                <div><b>{product.name}</b><small>{product.sku || "SKU not provided"}</small></div>
                <span>{product.views.toLocaleString("en-IN")} views</span>
                <strong>{product.stock} units · {product.availability}</strong>
              </article>
            )) : <p className="muted">No zero- or low-stock products in the current snapshot.</p>}
          </section>
        </div>

        <div className="stack">
          <section className="panel chat">
            <div className="chathead">
              <div><small>VOICE-FIRST SELLER CONVERSATION</small><h2>Your Virtual KAM</h2></div>
              <button disabled={!voice.supported || busy} onClick={voice.listening ? voice.stop : voice.start}>
                {voice.listening ? "Stop listening" : "🎙 Talk to KAM"}
              </button>
            </div>
            {!voice.supported && <p className="notice">Microphone speech recognition is unavailable in this browser. You can still use the text conversation.</p>}
            <div className="messages" aria-live="polite">
              {chat.messages.map((message, index) => (
                <article className={`bubble ${message.role}`} key={message._id || index}>
                  <small>{message.role === "assistant" ? "VIRTUAL KAM" : "YOU"}</small>
                  <p>{message.content}</p>
                </article>
              ))}
              {busy && <p className="notice">Reviewing your account and preparing the next step…</p>}
            </div>
            <form onSubmit={submit}>
              <input value={draft} onChange={event => setDraft(event.target.value)} placeholder="Tell me what is happening…" aria-label="Message your Virtual KAM" />
              <button disabled={busy || !draft.trim()}>Send</button>
            </form>
            <label className="voiceToggle"><input type="checkbox" checked={voice.enabled} onChange={event => voice.setEnabled(event.target.checked)} /> Speak responses aloud</label>
            <div className="agentStatus">Conversation engine: {provider === "langchain-gemini" ? "LangChain + Gemini" : provider === "deterministic-fallback" ? "Deterministic fallback" : "Ready · configured on server"}</div>
          </section>

          <section className="panel">
            <div className="panelTitle"><div><small>ACCOUNTABILITY LOOP</small><h2>Commitments & follow-up</h2></div><span className="count">{openCommitments.length} open</span></div>
            <p className="muted">Commitments are saved only after the seller states an action and a clear due date. Follow-up check-ins stay attached to this conversation.</p>
            {commitments.length === 0 ? <p className="muted empty">No commitments yet. Agree on one concrete action and due date with your Virtual KAM.</p> : commitments.map(commitment => (
              <article className="commit" key={commitment._id}>
                <div className="actionHeading"><b>{commitment.action}</b><span className={`status ${commitment.status}`}>{commitment.status}</span></div>
                <p>Due {new Date(commitment.dueDate).toLocaleDateString("en-IN")} · Follow-up {new Date(commitment.followUpAt).toLocaleDateString("en-IN")}</p>
                {commitment.lastFollowUpAt && <small>Last checked in {new Date(commitment.lastFollowUpAt).toLocaleString("en-IN")}</small>}
                {commitment.sellerNote && <p>{commitment.sellerNote}</p>}
                <div className="commitActions">
                  <button className="secondary" onClick={() => checkIn(commitment._id)}>Check in</button>
                  {commitment.status !== "completed" && <button className="secondary" onClick={() => updateCommitment(commitment._id, "completed")}>Mark complete</button>}
                  {commitment.status !== "blocked" && commitment.status !== "completed" && <button className="secondary" onClick={() => updateCommitment(commitment._id, "blocked")}>Flag blocker</button>}
                </div>
              </article>
            ))}
          </section>
        </div>
      </section>

      {error && <div className="error" role="alert">{error}</div>}
      <footer>Independent concept prototype · Synthetic seller data · No production Snapdeal account access or marketplace changes</footer>
    </main>
  );
}

function money(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);
}
