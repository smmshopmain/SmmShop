import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { ok } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { notifyInApp } from "@/lib/notifications";
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
  supportTicketKeyboard,
  telegramWebhookSecret,
} from "@/lib/telegram";
import { Deposit, Ticket, User } from "@/models";

type TelegramCallbackQuery = {
  id: string;
  data?: string;
  from?: { id?: number };
  message?: {
    message_id?: number;
    chat?: { id?: string | number; type?: string };
  };
};

type TelegramMessage = {
  message_id?: number;
  from?: { id?: number };
  chat?: { id?: string | number; type?: string };
  text?: string;
  reply_to_message?: { text?: string };
};

type TelegramUpdate = {
  callback_query?: TelegramCallbackQuery;
  message?: TelegramMessage;
};

function isTelegramAdmin(source: { from?: { id?: number }; chat?: { id?: string | number; type?: string } }) {
  const adminId = process.env.TELEGRAM_ADMIN_ID;
  const fromId = source.from?.id ? String(source.from.id) : "";
  if (!fromId) return false;

  if (adminId) return fromId === adminId;

  const chatId = process.env.TELEGRAM_CHAT_ID;
  return Boolean(
    chatId &&
    source.chat?.type === "private" &&
    String(source.chat.id ?? "") === chatId &&
    fromId === chatId,
  );
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

function isTicketId(value: string) {
  return /^[a-f\d]{24}$/i.test(value);
}

function ticketKeyboard(ticket: { _id: unknown; status: string; priority: string }) {
  return supportTicketKeyboard(String(ticket._id), ticket.status, ticket.priority);
}

function ticketMessageText(ticket: {
  _id: unknown;
  subject: string;
  category?: string;
  priority: string;
  status: string;
  messages: Array<{ body: string; isAdmin?: boolean }>;
  user?: { name?: string; email?: string; phone?: string } | null;
}) {
  const messages = ticket.messages.slice(-6).map((message) =>
    `${message.isAdmin ? "SUPPORT" : "CUSTOMER"}: ${message.body.slice(0, 450)}`,
  );
  return [
    `🎫 Support ticket #${String(ticket._id).slice(-7).toUpperCase()}`,
    `ID: ${String(ticket._id)}`,
    `Subject: ${ticket.subject}`,
    `Category: ${ticket.category ?? "other"}`,
    `Priority: ${ticket.priority}`,
    `Status: ${ticket.status}`,
    `Customer: ${ticket.user?.name ?? "User"} (${ticket.user?.email ?? "email unavailable"})`,
    ...(ticket.user?.phone ? [`Phone: ${ticket.user.phone}`] : []),
    "",
    ...messages,
    ...(ticket.messages.length > 6 ? ["", "Showing the latest 6 messages."] : []),
    "",
    "Use Reply / Close / Reopen below, or /reply <id> <message>.",
  ].join("\n").slice(0, 4000);
}

async function sendTicketDetails(chatId: string | number, ticketId: string) {
  if (!isTicketId(ticketId)) {
    await sendTelegramMessage({ chatId: String(chatId), text: "Invalid ticket ID. Use /tickets to find a request." });
    return;
  }

  await dbConnect();
  const ticket = await Ticket.findById(ticketId).populate("user", "name email phone").lean();
  if (!ticket) {
    await sendTelegramMessage({ chatId: String(chatId), text: "Ticket not found." });
    return;
  }
  await sendTelegramMessage({
    chatId: String(chatId),
    text: ticketMessageText(ticket),
    replyMarkup: ticketKeyboard(ticket),
  });
}

async function listSupportTickets(chatId: string | number, statusInput = "open") {
  await dbConnect();
  const status = statusInput.toLowerCase();
  const filter = status === "all"
    ? {}
    : status === "closed"
      ? { status: "Closed" }
      : status === "answered"
        ? { status: "Answered" }
        : { status: "Open" };
  const tickets = await Ticket.find(filter)
    .populate("user", "name email")
    .sort({ updatedAt: -1 })
    .limit(10)
    .lean();

  if (!tickets.length) {
    await sendTelegramMessage({ chatId: String(chatId), text: `No ${status} support tickets found.` });
    return;
  }

  await sendTelegramMessage({
    chatId: String(chatId),
    text: `🎫 ${status[0].toUpperCase()}${status.slice(1)} support tickets (latest ${tickets.length})`,
    replyMarkup: {
      inline_keyboard: tickets.map((ticket) => [{
        text: `${ticket.status === "Open" ? "🟠" : ticket.status === "Answered" ? "🔵" : "✅"} ${ticket.subject.slice(0, 42)} · ${ticket.user?.name ?? "Customer"}`,
        callback_data: `ticket:view:${ticket._id}`,
      }]),
    },
  });
}

async function updateSupportTicket(
  ticketId: string,
  action: "reply" | "close" | "reopen" | "priority",
  value?: string,
) {
  if (!isTicketId(ticketId)) throw new Error("Ticket ID must be 24 characters. Use /tickets to find the request.");
  await dbConnect();
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw new Error("Ticket not found.");

  if (action === "reply") {
    const reply = value?.trim();
    if (!reply || reply.length < 2 || reply.length > 5000) {
      throw new Error("Reply must contain between 2 and 5000 characters.");
    }
    ticket.messages.push({ body: reply, isAdmin: true });
    ticket.status = "Answered";
  } else if (action === "close") {
    if (ticket.status === "Closed") throw new Error("Ticket is already closed.");
    ticket.status = "Closed";
  } else if (action === "reopen") {
    if (ticket.status !== "Closed") throw new Error("Ticket is not closed.");
    ticket.status = "Open";
  } else {
    if (!value || !["Low", "Medium", "High"].includes(value)) {
      throw new Error("Priority must be Low, Medium, or High.");
    }
    ticket.priority = value;
  }

  await ticket.save();
  if (action === "reply" || action === "close" || action === "reopen") {
    const title = action === "reply"
      ? "Support replied to your ticket"
      : action === "close"
        ? "Support ticket closed"
        : "Support ticket reopened";
    await notifyInApp({ user: ticket.user, title, body: ticket.subject });
  }
  return ticket;
}

async function handleTelegramMessage(message: TelegramMessage) {
  const chatId = message.chat?.id;
  const text = message.text?.trim() ?? "";
  if (!chatId || !text) return ok({ ignored: true });

  const replyPrompt = message.reply_to_message?.text?.match(/Reply to support ticket ([a-f\d]{24}):/i);
  if (replyPrompt && !text.startsWith("/")) {
    try {
      const ticket = await updateSupportTicket(replyPrompt[1], "reply", text);
      await sendTelegramMessage({
        chatId: String(chatId),
        text: `✅ Reply sent to “${ticket.subject}”. Ticket is now Answered.`,
        replyMarkup: ticketKeyboard(ticket),
      });
    } catch (error) {
      await sendTelegramMessage({
        chatId: String(chatId),
        text: error instanceof Error ? error.message : "Unable to send support reply.",
      });
    }
    return ok({ ticketReply: true });
  }
  if (!text.startsWith("/")) return ok({ ignored: true });

  const [rawCommand, ...args] = text.split(/\s+/);
  const command = rawCommand.toLowerCase().split("@")[0];
  if (command === "/pending" || command === "/deposits") {
    return sendPendingDeposits(chatId);
  }

  if (command === "/tickets" || command === "/support") {
    const status = args[0] ?? "open";
    if (!["open", "answered", "closed", "all"].includes(status.toLowerCase())) {
      await sendTelegramMessage({
        chatId: String(chatId),
        text: "Usage: /tickets [open|answered|closed|all]",
      });
      return ok({ invalidStatus: true });
    }
    await listSupportTickets(chatId, status);
    return ok({ tickets: true });
  }

  if (command === "/ticket") {
    await sendTicketDetails(chatId, args[0] ?? "");
    return ok({ ticket: true });
  }

  if (command === "/reply") {
    const match = text.match(/^\/reply(?:@\w+)?\s+([a-f\d]{24})\s+([\s\S]+)$/i);
    if (!match) {
      await sendTelegramMessage({ chatId: String(chatId), text: "Usage: /reply <ticket-id> <your reply>" });
      return ok({ invalidReply: true });
    }
    try {
      const ticket = await updateSupportTicket(match[1], "reply", match[2]);
      await sendTelegramMessage({
        chatId: String(chatId),
        text: `✅ Reply sent to “${ticket.subject}”. Ticket is now Answered.`,
        replyMarkup: ticketKeyboard(ticket),
      });
    } catch (error) {
      await sendTelegramMessage({
        chatId: String(chatId),
        text: error instanceof Error ? error.message : "Unable to send support reply.",
      });
    }
    return ok({ ticketReply: true });
  }

  if (command === "/close" || command === "/reopen") {
    const ticketId = args[0] ?? "";
    try {
      const ticket = await updateSupportTicket(ticketId, command.slice(1) as "close" | "reopen");
      await sendTelegramMessage({
        chatId: String(chatId),
        text: `✅ Ticket “${ticket.subject}” is now ${ticket.status}.`,
        replyMarkup: ticketKeyboard(ticket),
      });
    } catch (error) {
      await sendTelegramMessage({
        chatId: String(chatId),
        text: error instanceof Error ? error.message : "Unable to update support ticket.",
      });
    }
    return ok({ ticketStatus: command.slice(1) });
  }

  if (command === "/priority") {
    const ticketId = args[0] ?? "";
    const priority = args[1] ?? "";
    try {
      const ticket = await updateSupportTicket(ticketId, "priority", priority);
      await sendTelegramMessage({
        chatId: String(chatId),
        text: `✅ Priority for “${ticket.subject}” is now ${ticket.priority}.`,
        replyMarkup: ticketKeyboard(ticket),
      });
    } catch (error) {
      await sendTelegramMessage({
        chatId: String(chatId),
        text: error instanceof Error ? error.message : "Unable to update ticket priority.",
      });
    }
    return ok({ ticketPriority: true });
  }

  if (command === "/start") {
    await sendTelegramMessage({
      chatId: String(chatId),
      text: "Support management is ready. Use /help to see available commands.",
    });
    return ok({ start: true });
  }

  if (command === "/help") {
    await sendTelegramMessage({
      chatId: String(chatId),
      text: [
        "📌 Admin commands:",
        "/myid - Show your Telegram user ID for admin setup",
        "/tickets [open|answered|closed|all] - List support tickets",
        "/ticket <id> - Open ticket conversation",
        "/reply <id> <message> - Reply to customer",
        "/close <id> - Close ticket",
        "/reopen <id> - Reopen ticket",
        "/priority <id> <Low|Medium|High> - Change priority",
        "Tap Reply on a ticket and reply to the bot prompt to chat.",
        "",
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
  const expectedSecret = telegramWebhookSecret();
  const receivedSecret = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  const expectedBuffer = Buffer.from(expectedSecret);
  const receivedBuffer = Buffer.from(receivedSecret);
  if (
    !expectedSecret ||
    expectedBuffer.length !== receivedBuffer.length ||
    !timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    return ok({ unauthorized: true }, { status: 401 });
  }

  const update = (await request.json().catch(() => ({}))) as TelegramUpdate;
  const callback = update.callback_query;
  const message = update.message;

  if (!callback?.id && !message?.text) return ok({ ignored: true });

  if (message) {
    if (message.text?.trim().split(/\s+/)[0].toLowerCase().split("@")[0] === "/myid") {
      await sendTelegramMessage({
        chatId: String(message.chat?.id),
        text: message.from?.id
          ? `Your Telegram user ID is ${message.from.id}.`
          : "Could not read your Telegram user ID.",
      });
      return ok({ telegramIdReturned: Boolean(message.from?.id) });
    }
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

  if (callback.data.startsWith("ticket:")) {
    const [, action, ticketId, value] = callback.data.split(":");
    const chatId = callback.message?.chat?.id;
    if (!action || !ticketId || !chatId) {
      await answerTelegramCallback(callback.id, "Invalid ticket action", true);
      return ok({ invalidTicketAction: true });
    }

    if (action === "view") {
      await answerTelegramCallback(callback.id, "Loading ticket");
      await sendTicketDetails(chatId, ticketId);
      return ok({ ticketViewed: true });
    }

    if (action === "reply") {
      if (!isTicketId(ticketId)) {
        await answerTelegramCallback(callback.id, "Invalid ticket ID", true);
        return ok({ invalidTicketId: true });
      }
      await dbConnect();
      if (!(await Ticket.exists({ _id: ticketId }))) {
        await answerTelegramCallback(callback.id, "Ticket not found", true);
        return ok({ missing: true });
      }
      await sendTelegramMessage({
        chatId: String(chatId),
        text: `Reply to support ticket ${ticketId}:`,
        replyMarkup: {
          force_reply: true,
          input_field_placeholder: "Type your reply to the customer",
        },
      });
      await answerTelegramCallback(callback.id, "Reply to the bot prompt to send your message.");
      return ok({ awaitingReply: true });
    }

    if (action === "close" || action === "reopen" || action === "priority") {
      try {
        const ticket = await updateSupportTicket(
          ticketId,
          action,
          action === "priority" ? value : undefined,
        );
        await clearButtons(callback);
        await answerTelegramCallback(callback.id, `${ticket.status} · ${ticket.priority}`);
        await sendTicketDetails(chatId, String(ticket._id));
      } catch (error) {
        await answerTelegramCallback(
          callback.id,
          error instanceof Error ? error.message : "Unable to update ticket.",
          true,
        );
      }
      return ok({ ticketUpdated: true });
    }

    await answerTelegramCallback(callback.id, "Unsupported ticket action", true);
    return ok({ ignored: true });
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
      source: "telegram_deposit_approved",
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
      source: "telegram_deposit_rejected",
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
    privateChatFallbackConfigured: Boolean(process.env.TELEGRAM_CHAT_ID),
    webhookSecretConfigured: Boolean(telegramWebhookSecret()),
  });
}
