import { Router } from "express";
import mongoose from "mongoose";
import {
  SellerModel as Seller,
  ConversationModel as Conversation,
  CommitmentModel as Commitment
} from "../models/models.ts";
import { analyzeSeller } from "../services/diagnostics.ts";
import { runVirtualKam } from "../agent/virtualKam.ts";

const router = Router();

router.get("/sellers", async (_request, response, next) => {
  try {
    response.json(await Seller.find().select("name contactName category location demo"));
  } catch (error) {
    next(error);
  }
});

router.get("/sellers/:id/analysis", async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) return response.status(400).json({ error: "Invalid seller id" });
    const seller = await Seller.findById(request.params.id);
    if (!seller) return response.status(404).json({ error: "Seller not found" });
    response.json(analyzeSeller(seller));
  } catch (error) {
    next(error);
  }
});

router.post("/conversations", async (request, response, next) => {
  try {
    const sellerId = request.body?.sellerId;
    const seller = mongoose.isValidObjectId(sellerId) ? await Seller.findById(sellerId) : null;
    if (!seller) return response.status(400).json({ error: "A valid sellerId is required" });
    const analysis = analyzeSeller(seller);
    const opening = `Hello ${seller.contactName || "there"}. I have reviewed your last 30 days. Revenue is ${analysis.changes.revenueLabel}. ${analysis.driverSummary} Before suggesting more advertising or discounts, I want to understand the operational reason. What has changed most on your side recently?`;
    const conversation = await Conversation.create({
      sellerId,
      messages: [{ role: "assistant", content: opening }]
    });
    response.status(201).json(conversation);
  } catch (error) {
    next(error);
  }
});

router.post("/conversations/:id/turn", async (request, response, next) => {
  try {
    const message = request.body?.message;
    if (typeof message !== "string" || !message.trim() || message.length > 2000) {
      return response.status(400).json({ error: "Message must contain 1 to 2000 characters" });
    }
    if (!mongoose.isValidObjectId(request.params.id)) return response.status(400).json({ error: "Invalid conversation id" });
    const conversation = await Conversation.findById(request.params.id);
    if (!conversation || conversation.status !== "active") return response.status(404).json({ error: "Active conversation not found" });
    const seller = await Seller.findById(conversation.sellerId);
    if (!seller) return response.status(404).json({ error: "Seller not found" });

    const history = conversation.messages.map(item => ({ role: item.role, content: item.content }));
    const cleanMessage = message.trim();
    const result = await runVirtualKam({ seller, messages: history, userMessage: cleanMessage });
    conversation.messages.push({ role: "user", content: cleanMessage }, { role: "assistant", content: result.reply });

    if (result.intent === "commitment" && result.commitment?.confirmed && result.commitment.action?.trim()) {
      const dueDate = new Date(result.commitment.dueDate);
      if (!Number.isNaN(dueDate.getTime()) && dueDate > new Date()) {
        const followUpAt = new Date(dueDate);
        followUpAt.setDate(followUpAt.getDate() + 1);
        await Commitment.create({
          sellerId: seller._id,
          conversationId: conversation._id,
          action: result.commitment.action.trim(),
          dueDate,
          followUpAt,
          confirmedBySeller: true
        });
      }
    }

    await conversation.save();
    response.json({
      reply: result.reply,
      intent: result.intent,
      analysis: result.analysis,
      provider: result.provider,
      warning: result.warning,
      conversation
    });
  } catch (error) {
    next(error);
  }
});

router.get("/sellers/:id/commitments", async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) return response.status(400).json({ error: "Invalid seller id" });
    const commitments = await Commitment.find({ sellerId: request.params.id }).sort({ followUpAt: 1, dueDate: 1 });
    response.json(commitments);
  } catch (error) {
    next(error);
  }
});

router.patch("/commitments/:id", async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) return response.status(400).json({ error: "Invalid commitment id" });
    const { status, sellerNote } = request.body || {};
    if (!(["open", "completed", "blocked"] as string[]).includes(status)) {
      return response.status(400).json({ error: "Status must be open, completed or blocked" });
    }
    if (sellerNote !== undefined && (typeof sellerNote !== "string" || sellerNote.length > 500)) {
      return response.status(400).json({ error: "sellerNote must be a string of at most 500 characters" });
    }
    const commitment = await Commitment.findByIdAndUpdate(
      request.params.id,
      { status, ...(sellerNote !== undefined ? { sellerNote: sellerNote.trim() } : {}) },
      { new: true, runValidators: true }
    );
    if (!commitment) return response.status(404).json({ error: "Commitment not found" });
    response.json(commitment);
  } catch (error) {
    next(error);
  }
});

router.post("/commitments/:id/check-in", async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) return response.status(400).json({ error: "Invalid commitment id" });
    const commitment = await Commitment.findById(request.params.id);
    if (!commitment) return response.status(404).json({ error: "Commitment not found" });
    const now = new Date();
    commitment.lastFollowUpAt = now;
    await commitment.save();

    const checkIn = commitment.status === "completed"
      ? `You marked this action as completed: ${commitment.action}. Let's verify the impact in your latest seller metrics.`
      : commitment.status === "blocked"
        ? `You flagged a blocker for: ${commitment.action}. What is preventing progress, and what support or decision would unblock it?`
        : `A quick follow-up on your commitment: ${commitment.action}, due ${new Date(commitment.dueDate).toLocaleDateString("en-IN")}. Have you completed it, or is anything blocking you?`;

    const conversation = await Conversation.findById(commitment.conversationId);
    if (conversation && conversation.status === "active") {
      conversation.messages.push({ role: "assistant", content: checkIn });
      await conversation.save();
    }
    response.json({ checkIn, commitment, conversation });
  } catch (error) {
    next(error);
  }
});

export default router;
