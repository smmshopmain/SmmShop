import { NextRequest } from "next/server";
import { ok } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import {
  TELEGRAM_REJECT_REASONS,
  applyDepositDecision,
  depositRejectReasonKeyboard,
  depositTelegramKeyboard,
} from "@/lib/deposits";
import {
  answerTelegramCallback,
  editTelegramMessageReplyMarkup,
  sendTelegramMessage,
} from "@/lib/telegram";
import { Deposit } from "@/models";

type TelegramCallbackQuery = {
  id: string;
  data?: string;
  from?: { id?: number };
  message?: {
    message_id?: number;
    chat?: { id?: string | number };
  };
};

type TelegramMessage = {
  message_id?: number;
  from?: { id?: number };
  chat?: { id?: string | number };
  text?: string;
};

type TelegramUpdate = {
  callback_query?: TelegramCallbackQuery;
  message?: TelegramMessage;
};

function isTelegramAdmin(source: { from?: { id?: number }; chat?: { id?: string | number } }) {
  const adminId = process.env.TELEGRAM_ADMIN_ID;
  const fromId = source.from?.id ? String(source.from.id) : "";
  if (adminId) return fromId === adminId;

  const chatId = source.chat?.id ? String(source.chat.id) : "";
  return Boolean(fromId && process.env.TELEGRAM_CHAT_ID && fromId === process.env.TELEGRAM_CHAT_ID && chatId === fromId);
}

async function clearButtons(callback: TelegramCallbackQuery) {
  const chatId = callback.message?.chat?.id;
  const messageId = callback.message?.message_id;
  if (!chatId || !messageId) return;
  await editTelegramMessageReplyMarkup({ chatId, messageId });
}

async function sendPendingDeposits(chatId: string | number) {
  await dbConnect();
  const deposits = await Deposit.find({ status: "Pending" }).sort({ createdAt: 1 }).limit(10).lean();

  if (deposits.length === 0) {
    await sendTelegramMessage({ chatId: String(chatId), text: "No pending deposits found." });
    return ok({ noPending: true });
  }

  const lines = deposits.map((deposit) =>
    `${deposit.depositId ?? String(deposit._id)} — ₹${deposit.amount} — UTR ${deposit.utr}`,
  );
  const replyMarkup = {
    inline_keyboard: deposits.map((deposit) => [
      {
        text: `Review ${deposit.depositId ?? String(deposit._id).slice(-6)}`,
        callback_data: `dep:review:${deposit._id}`,
      },
    ]),
  };

  await sendTelegramMessage({
    chatId: String(chatId),
    text: [
      "🔔 Pending Deposit Requests",
      "",
      ...lines,
      "",
      "Tap any request to review and approve/reject it.",
    ].join("\n"),
    replyMarkup,
  });

  return ok({ pendingCount: deposits.length });
}

async function handleTelegramMessage(message: TelegramMessage) {
  const chatId = message.chat?.id;
  const text = message.text?.trim() ?? "";
  if (!chatId || !text.startsWith("/")) return ok({ ignored: true });

  const command = text.split(" ")[0].toLowerCase();
  if (command === "/pending" || command === "/deposits") {
    return sendPendingDeposits(chatId);
  }

  if (command === "/help") {
    await sendTelegramMessage({
      chatId: String(chatId),
      text: [
        "📌 Admin commands:",
        "/pending - List pending deposit requests",
        "/deposits - Same as /pending",
        "/help - Show this menu",
      ].join("\n"),
    });
    return ok({ help: true });
  }

  return ok({ ignored: true });
}

export async function POST(request: NextRequest) {
  const update = (await request.json().catch(() => ({}))) as TelegramUpdate;
  const callback = update.callback_query;
  const message = update.message;

  if (!callback?.id && !message?.text) return ok({ ignored: true });

  if (message) {
    if (!isTelegramAdmin(message)) {
      await sendTelegramMessage({ chatId: String(message.chat?.id), text: "❌ Unauthorized action." });
      return ok({ unauthorized: true });
    }
    return handleTelegramMessage(message);
  }

  if (!callback?.data) return ok({ ignored: true });

  if (!isTelegramAdmin(callback)) {
    await answerTelegramCallback(callback.id, "❌ Unauthorized Action", true);
    return ok({ unauthorized: true });
  }

  const [scope, action, depositId, reasonCode] = callback.data.split(":");
  if (scope !== "dep" || !action || !depositId) {
    await answerTelegramCallback(callback.id, "Unsupported action", true);
    return ok({ ignored: true });
  }

  await dbConnect();
  const deposit = await Deposit.findById(depositId);
  if (!deposit) {
    await answerTelegramCallback(callback.id, "Deposit not found", true);
    return ok({ missing: true });
  }

  if (deposit.status !== "Pending") {
    await clearButtons(callback);
    await answerTelegramCallback(callback.id, `Already ${deposit.status}`, true);
    return ok({ alreadyReviewed: true });
  }

  if (action === "reject") {
    const chatId = callback.message?.chat?.id;
    const messageId = callback.message?.message_id;
    if (chatId && messageId) {
      await editTelegramMessageReplyMarkup({
        chatId,
        messageId,
        replyMarkup: depositRejectReasonKeyboard(deposit._id),
      });
    }
    await answerTelegramCallback(callback.id, "Select rejection reason");
    return ok({ awaitingReason: true });
  }

  if (action === "approve") {
    await applyDepositDecision({
      deposit,
      decision: { status: "Approved" },
      source: "deposit_approved",
      adminAction: "telegram_approve",
      adminTelegramId: String(callback.from?.id),
    });
    await clearButtons(callback);
    await answerTelegramCallback(callback.id, "✅ Deposit approved");
    return ok({ approved: true });
  }

  if (action === "review") {
    const chatId = callback.message?.chat?.id;
    await answerTelegramCallback(callback.id, "Review request loaded");
    if (!chatId) return ok({ missingChat: true });

    const text = [
      "🔎 Deposit request details",
      "",
      `ID: ${deposit.depositId ?? String(deposit._id)}`,
      `Amount: ₹${deposit.amount}`,
      `UTR: ${deposit.utr}`,
      `Status: ${deposit.status}`,
      `User ID: USER-${String(deposit.user).slice(-6).toUpperCase()}`,
      "",
      "Approve or reject this request:",
    ].join("\n");

    await sendTelegramMessage({
      chatId: String(chatId),
      text,
      replyMarkup: depositTelegramKeyboard(deposit._id),
    });
    return ok({ reviewSent: true });
  }

  if (action === "reason") {
    const reason = TELEGRAM_REJECT_REASONS[reasonCode ?? ""] ?? TELEGRAM_REJECT_REASONS.other;
    await applyDepositDecision({
      deposit,
      decision: { status: "Rejected", message: reason },
      source: "deposit_rejected",
      adminAction: "telegram_reject",
      adminTelegramId: String(callback.from?.id),
    });
    await clearButtons(callback);
    await answerTelegramCallback(callback.id, "❌ Deposit rejected");
    return ok({ rejected: true, reason });
  }

  await sendTelegramMessage({ text: "Unsupported deposit action." });
  await answerTelegramCallback(callback.id, "Unsupported action", true);
  return ok({ ignored: true });
}

export async function GET() {
  return ok({
    ready: true,
    webhook: "/api/telegram/deposits",
    adminConfigured: Boolean(process.env.TELEGRAM_ADMIN_ID),
  });
}
