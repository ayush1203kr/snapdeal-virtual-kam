import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { z } from "zod";
import { analyzeSeller } from "../services/diagnostics.ts";
import { extractSellerCommitment } from "./commitmentParser.ts";

const responseSchema = z.object({
  reply: z.string(),
  intent: z.enum(["diagnose", "clarify", "recommend", "commitment", "general"]),
  followUpQuestion: z.string().optional()
});

type AgentResult = {
  reply: string;
  intent: "diagnose" | "clarify" | "recommend" | "commitment" | "general";
  followUpQuestion?: string;
  commitment?: { action: string; dueDate: string; confirmed: boolean };
  analysis: ReturnType<typeof analyzeSeller>;
  provider: string;
  warning?: string;
};

const systemPrompt = `You are an empathetic, commercially sharp seller success manager for an Indian ecommerce marketplace. You own the seller's sales-decline problem from diagnosis through action and follow-up.

Operating rules:
- Use only the seller metrics, product facts and computed diagnosis in the context. Never invent numbers, platform policies, competitor facts or causes.
- Start with the strongest evidence. Distinguish traffic, conversion, availability, cancellations, average order value, ratings and returns.
- Explain percentage change in plain language. Do not confuse percentage change with percentage-point change.
- Ask one focused question at a time. Ask about the most important unknown that would change the action plan.
- Recommend actions in priority order with a first step, owner, timeline and measurable outcome.
- Protect seller margin. Never recommend blanket discounts or more advertising before checking stock, listing quality and fulfilment readiness.
- Do not claim to have changed inventory, listings, prices, campaigns, orders or account settings.
- Do not claim a commitment has been recorded. The application records one only when the seller explicitly states an action and a clear future due date.
- Keep the spoken reply concise, warm and natural in Indian English. Avoid jargon and long lists.
- End with one useful question or a clear next step when appropriate.`;


function fallbackReply(text: string, analysis: ReturnType<typeof analyzeSeller>, history: Array<{ role: string; content: string }>) {
  const lower = text.toLowerCase();
  const latestAssistant = [...history].reverse().find(message => message.role === "assistant")?.content.toLowerCase() || "";
  const topSignals = analysis.signals.slice(0, 2).map(signal => signal.title.toLowerCase());

  if (/\b(plan|recommend|what should|next steps|7 day|seven day)\b/.test(lower)) {
    const first = analysis.actions[0];
    const second = analysis.actions[1];
    return {
      intent: "recommend" as const,
      reply: first
        ? `I would start with ${first.title.toLowerCase()}. ${first.firstStep} ${second ? `After that, ${second.firstStep}` : "Then we can review the result against your sales and fulfilment metrics."} Which of these can you take ownership of first?`
        : "Your current metrics do not show a major negative signal. Let's review your top products and recent order trends before changing anything. Which product is most important to your business right now?",
      followUpQuestion: "Which action can you take first?"
    };
  }

  if (/\b(why|reason|sales dropped|sales down|decline|falling)\b/.test(lower)) {
    return {
      intent: "diagnose" as const,
      reply: `I can see the decline in your numbers. ${analysis.driverSummary} I also see ${topSignals.join(" and ") || "some areas worth reviewing"}. I want to check the biggest operational risk first: are the products getting the most visits currently in stock and ready to ship?`,
      followUpQuestion: "Are your highest-traffic products in stock and ready to ship?"
    };
  }

  if (/\b(stock|inventory|out of stock|unavailable)\b/.test(lower)) {
    const product = analysis.unavailableProducts[0];
    return {
      intent: "clarify" as const,
      reply: product
        ? `${product.name} is the first product I would investigate because it has zero stock${product.views ? ` and ${product.views.toLocaleString("en-IN")} recorded views` : ""}. Do you have replenishment available, and when can you make the stock available?`
        : "Thanks for clarifying. I do not see a zero-stock SKU in the current snapshot. Is the issue a delayed replenishment, or is the seller-panel inventory different from your physical stock?",
      followUpQuestion: "When can you replenish the affected product?"
    };
  }

  if (/\b(cancel|cancellation|dispatch|shipment)\b/.test(lower)) {
    return {
      intent: "clarify" as const,
      reply: "Let's isolate the cancellation driver before we increase demand. Are most cancellations happening because stock is unavailable, orders are not dispatched on time, or buyers are cancelling for another reason?",
      followUpQuestion: "What is the most common cancellation reason?"
    };
  }

  if (/\b(return|rating|review|quality)\b/.test(lower)) {
    return {
      intent: "clarify" as const,
      reply: "Customer experience can affect both retained sales and future conversion. What are buyers mentioning most often: product quality, inaccurate descriptions, damaged packaging, or late delivery?",
      followUpQuestion: "What is the most frequent buyer complaint?"
    };
  }

  if (/\b(done|completed|finished)\b/.test(lower) && /commit|action|restock|inventory|listing/i.test(latestAssistant)) {
    return {
      intent: "general" as const,
      reply: "Good progress. Let's verify the result rather than assume the issue is fixed. Check the seller panel for updated stock and the next day's orders, then share what changed. What result are you seeing now?",
      followUpQuestion: "What changed after you completed the action?"
    };
  }

  return {
    intent: "clarify" as const,
    reply: "Let's narrow this down so I can give you the right next step. Are fewer shoppers visiting your products, or are shoppers visiting but not placing orders?",
    followUpQuestion: "Is the bigger issue traffic or conversion?"
  };
}


// Deterministic handling for important seller intents. This prevents repeated
// generic clarification questions and uses the actual seller snapshot.
function getGuidedSellerReply(text: string, seller: any, analysis: ReturnType<typeof analyzeSeller>) {
  const lower = text.toLowerCase();
  const products = Array.isArray(seller?.products) ? [...seller.products] : [];

  // Handle specific prioritisation requests BEFORE broad product questions.
  // This prevents "which product should I prioritise/prepare?" from being
  // treated as another request to repeat the product list.
  const prioritizationQuestion =
    /\b(prioriti[sz]e|prepare|prepared|preparing|practi[cs]e|practicing|restock|replenish|focus on|which one first|which product first)\b/i.test(lower) ||
    /\bwhich\b.{0,50}\b(product|sku|item)\b.{0,45}\b(first|priorit|prepar|practi|restock)\b/i.test(lower);

  if (prioritizationQuestion) {
    const ranked = [...products].sort((a, b) => {
      const priorityScore = (product: any) => {
        const stock = Number(product.stock ?? 0);
        const views = Number(product.views ?? 0);
        const orders = Number(product.orders ?? 0);

        // Stock risk comes first; customer interest breaks ties.
        const stockRisk = stock <= 0 ? 1_000_000 : stock <= 10 ? 500_000 : 0;
        return stockRisk + views - orders * 10;
      };

      return priorityScore(b) - priorityScore(a);
    });

    const first = ranked[0];
    const nextLowStock = ranked.find(
      product => product !== first && Number(product.stock ?? 0) <= 10
    );

    if (first) {
      const stock = Number(first.stock ?? 0);
      const stockStatus = stock <= 0 ? "out of stock" : "low on stock";
      const nextStep = stock <= 0
        ? "Restock it before spending more on advertising or discounts."
        : "Replenish it soon and monitor whether orders recover.";

      return {
        intent: "recommend" as const,
        reply: `Prioritise ${first.name} first. It has ${Number(first.views ?? 0).toLocaleString("en-IN")} views but only ${stock} units available, so it is ${stockStatus}. ${nextStep}${nextLowStock ? ` After that, replenish ${nextLowStock.name}, which has ${Number(nextLowStock.stock ?? 0)} units remaining and ${Number(nextLowStock.views ?? 0).toLocaleString("en-IN")} views.` : ""} Can you confirm when you can replenish ${first.name}?`,
        followUpQuestion: `When can you replenish ${first.name}?`
      };
    }

    return {
      intent: "clarify" as const,
      reply: "I do not have product-level stock records in this snapshot, so I cannot safely choose a product. Please share the available stock for your highest-view products.",
      followUpQuestion: "Which high-view product has the lowest available stock?"
    };
  }

  // Generic product-level questions (for example, "which products have most views?")
  const productQuestion = /\b(which|what|show|list|identify|top|highest|most)\b.{0,80}\b(products?|skus?|items?|views?|stock)\b|\b(products?|skus?)\b.{0,80}\b(contribut|sales decline|most views|zero stock|low stock)\b/i.test(lower);

  if (productQuestion) {
    const top = products
      .sort((a, b) => Number(b.views || 0) - Number(a.views || 0))
      .slice(0, 3);

    const details = top.map(p => {
      const stock = Number(p.stock || 0);
      const status = stock <= 0 ? "out of stock" : stock <= 10 ? "low stock" : "in stock";
      return `${p.name}: ${p.views || 0} views, ${p.orders || 0} orders, ${stock} units (${status})`;
    });

    return {
      intent: "diagnose" as const,
      reply: details.length
        ? "Here are your highest-view products: " + details.join("; ") +
          ". SKU-level comparisons with the previous month are not available in this demo, so I cannot attribute the entire sales decline to individual products. However, high-view products with low or zero stock deserve immediate attention."
        : "I do not have product-level records in this seller snapshot. Please check product views, orders and available stock in your seller panel.",
      followUpQuestion: "Shall we start with the highest-view product that has a stock issue?"
    };
  }

  // Conversion problem: shoppers visit but do not order
  const conversionProblem =
    /(visiting|visits|traffic|shoppers?|customers?|visitors?).{0,90}(not placing|not converting|no orders|aren't ordering|are not ordering|don't order|do not order)|\b(conversion|converting)\b/i.test(lower);

  if (conversionProblem) {
    const currentConversion = analysis.current.conversionRate;
    const previousConversion = analysis.previous.visits > 0
      ? analysis.previous.orders / analysis.previous.visits * 100
      : 0;

    const product = analysis.unavailableProducts[0];
    const stockDetail = product
      ? ` ${product.name} has ${product.stock} units and ${product.views} views (${product.availability}).`
      : "";

    return {
      intent: "diagnose" as const,
      reply: `Understood. This is primarily a conversion problem, not just a traffic problem. Your conversion rate is ${currentConversion.toFixed(2)}%, compared with ${previousConversion.toFixed(2)}% previously. That is a decline of ${analysis.changes.conversionPoints.toFixed(2)} percentage points. Catalogue availability is ${analysis.current.inStockPct}% and cancellations are ${analysis.current.cancellationPct}%.${stockDetail} First fix availability on high-view products. Then review pricing, listing images, product details and delivery promises. Are buyers objecting mainly to price, delivery or product information?`,
      followUpQuestion: "Are buyers objecting mainly to price, delivery or product information?"
    };
  }

  // Prioritized action plan
  if (/\b(plan|recommend|what should|next steps|prioriti[sz]|actions?|recover|improve sales|increase conversion)\b/i.test(lower)) {
    const actions = [...analysis.actions]
      .sort((a, b) => {
        const rank = (p: string) => p === "urgent" ? 0 : p === "high" ? 1 : 2;
        return rank(a.priority) - rank(b.priority);
      })
      .slice(0, 3);

    const actionDetails = actions.map((a, i) =>
      `${i + 1}. ${a.title}. First step: ${a.firstStep} Owner: ${a.owner}. Timeline: ${a.timeline}. Success measure: ${a.successMetric}.`
    ).join(" ");

    const followUp = /\b(follow.?up|check.?in|remind|tomorrow)\b/i.test(lower)
      ? " I can keep your agreed action visible in the in-app follow-up list, but this demo does not send automatic notifications. Open the app tomorrow and use Check in."
      : "";

    return {
      intent: "recommend" as const,
      reply: actions.length
        ? `Here is your prioritized recovery plan. ${actionDetails}${followUp} Which action will you take first, and by what date?`
        : "Your current snapshot does not show a major negative signal. Let's inspect your top products and recent buyer feedback first.",
      followUpQuestion: "Which action will you take first, and by what date?"
    };
  }

  // Follow-up request without an explicit action
  if (/\b(follow.?up|check.?in|remind)\b/i.test(lower)) {
    return {
      intent: "general" as const,
      reply: "I can support a follow-up using the in-app Check in button once we have a saved commitment. This demo does not send automatic reminders. What specific action will you take, and by what date?",
      followUpQuestion: "What action will you take, and by what date?"
    };
  }

  return null;
}


// Interpret a short time-only answer in the context of the previous replenishment
// question, so "after 1 month" is not mistaken for a new sales-diagnosis request.
function extractContextualReplenishmentCommitment(
  userMessage: string,
  messages: Array<{ role: string; content: string }>
) {
  const timingAnswer = userMessage.trim();
  const isOneMonth =
    /^(?:(?:after|in)\s+(?:1|one|a)\s+month|next\s+month)(?:\s+from\s+now)?[.! ]*$/i.test(timingAnswer);

  if (!isOneMonth) return null;

  const latestAssistant = [...messages]
    .reverse()
    .find(message => message.role === "assistant")
    ?.content || "";

  const questionMatch = latestAssistant.match(
    /when (?:can you|you can) (?:replenish|restock)\s+(.+?)[?.!]*$/i
  ) || latestAssistant.match(
    /when will you (?:replenish|restock)\s+(.+?)[?.!]*$/i
  );

  if (!questionMatch?.[1]) return null;

  const productName = questionMatch[1].trim();
  const dueDate = new Date();
  const originalDay = dueDate.getDate();

  // Add one calendar month without overflowing dates such as the 31st.
  dueDate.setDate(1);
  dueDate.setMonth(dueDate.getMonth() + 1);
  const lastDayOfTargetMonth = new Date(
    dueDate.getFullYear(),
    dueDate.getMonth() + 1,
    0
  ).getDate();
  dueDate.setDate(Math.min(originalDay, lastDayOfTargetMonth));
  dueDate.setHours(17, 0, 0, 0);

  return {
    action: `Replenish ${productName}`,
    dueDate: dueDate.toISOString()
  };
}

export async function runVirtualKam({ seller, messages, userMessage }: {
  seller: any;
  messages: Array<{ role: string; content: string }>;
  userMessage: string;
}): Promise<AgentResult> {
  const analysis = analyzeSeller(seller);
  const explicitCommitment =
    extractSellerCommitment(userMessage) ||
    extractContextualReplenishmentCommitment(userMessage, messages);

  if (!explicitCommitment) {
    const guided = getGuidedSellerReply(userMessage, seller, analysis);
    if (guided) {
      return {
        ...guided,
        analysis,
        provider: "deterministic-fallback"
      };
    }
  }

  if (!process.env.GEMINI_API_KEY) {
    const response = fallbackReply(userMessage, analysis, messages);
    return {
      ...response,
      ...(explicitCommitment ? { intent: "commitment" as const, commitment: { ...explicitCommitment, confirmed: true }, reply: `I have recorded your commitment: ${explicitCommitment.action}, due ${new Date(explicitCommitment.dueDate).toLocaleDateString("en-IN")}. I will keep it visible in your follow-up list. What could prevent this from being completed on time?` } : {}),
      analysis,
      provider: "deterministic-fallback"
    };
  }

  try {
    const model = new ChatGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      temperature: 0.2,
      maxOutputTokens: 450
    }).withStructuredOutput(responseSchema);
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", systemPrompt],
      ["system", "Seller profile and computed diagnosis: {context}"],
      new MessagesPlaceholder("history"),
      ["human", "{input}"]
    ]);
    const history = messages.slice(-10).map(message =>
      message.role === "assistant" ? new AIMessage(message.content) : new HumanMessage(message.content)
    );
    const result = await prompt.pipe(model).invoke({
      context: JSON.stringify({
        seller: seller.name,
        category: seller.category,
        previous: analysis.previous,
        current: analysis.current,
        driverSummary: analysis.driverSummary,
        signals: analysis.signals,
        actions: analysis.actions,
        unavailableProducts: analysis.unavailableProducts
      }),
      history,
      input: userMessage
    });

    const unsupportedCommitmentClaim = /recorded your commitment|commitment has been recorded|saved your commitment/i.test(result.reply);
    const unsupportedExecutionClaim = /\b(i have|i've|we have|we've)\s+(updated|changed|restocked|paused|launched|modified|reduced|increased)\b/i.test(result.reply);
    const safeResult = explicitCommitment
      ? {
          ...result,
          intent: "commitment" as const,
          commitment: { ...explicitCommitment, confirmed: true },
          reply: `I have recorded your commitment: ${explicitCommitment.action}, due ${new Date(explicitCommitment.dueDate).toLocaleDateString("en-IN")}. I will keep it visible in your follow-up list. What could prevent this from being completed on time?`
        }
      : result.intent === "commitment" || unsupportedCommitmentClaim
        ? {
            ...result,
            intent: "clarify" as const,
            reply: "I can help track that. What specific action will you take, and by what date can you complete it?"
          }
        : unsupportedExecutionClaim
          ? {
              ...result,
              intent: "clarify" as const,
              reply: "I can guide you through that change, but I cannot update your seller account from this demo. Please make the change in your seller panel, then tell me when it is done so we can verify the result."
            }
          : result;

    return {
      ...safeResult,
      analysis,
      provider: "langchain-gemini"
    };
  } catch {
    const response = fallbackReply(userMessage, analysis, messages);
    return {
      ...response,
      ...(explicitCommitment ? { intent: "commitment" as const, commitment: { ...explicitCommitment, confirmed: true }, reply: `I have recorded your commitment: ${explicitCommitment.action}, due ${new Date(explicitCommitment.dueDate).toLocaleDateString("en-IN")}. I will keep it visible in your follow-up list.` } : {}),
      analysis,
      provider: "deterministic-fallback",
      warning: "The language model was unavailable; deterministic seller-support logic was used."
    };
  }
}
