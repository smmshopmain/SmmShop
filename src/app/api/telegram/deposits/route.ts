import { NextRequest } from "next/server";
import { ok } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import {
  TELEGRAM_REJECT_REASONS,
  applyDepositDecision,
  depositRejectReasonKeyboard,
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

type TelegramUpdate = {
  callback_query?: TelegramCallbackQuery;
};

function isTelegramAdmin(callback: TelegramCallbackQuery) {
  const adminId = process.env.TELEGRAM_ADMIN_ID;
  const fromId = callback.from?.id ? String(callback.from.id) : "";
  if (adminId) return fromId === adminId;

  const chatId = callback.message?.chat?.id ? String(callback.message.chat.id) : "";
  return Boolean(fromId && process.env.TELEGRAM_CHAT_ID && fromId === process.env.TELEGRAM_CHAT_ID && chatId === fromId);
}

async function clearButtons(callback: TelegramCallbackQuery) {
  const chatId = callback.message?.chat?.id;
  const messageId = callback.message?.message_id;
  if (!chatId || !messageId) return;
  await editTelegramMessageReplyMarkup({ chatId, messageId });
}

export async function POST(request: NextRequest) {
  const update = (await request.json().catch(() => ({}))) as TelegramUpdate;
  const callback = update.callback_query;
  if (!callback?.id || !callback.data) return ok({ ignored: true });

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
