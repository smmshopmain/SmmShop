import { createHash } from "node:crypto";

export async function notifyTelegram(title: string, lines: string[] = [], replyMarkup?: unknown) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn("Telegram notification skipped because bot credentials are not configured.");
    return false;
  }

  const text = [`*${escapeMarkdown(title)}*`, ...lines.map(escapeMarkdown)].join("\n");

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "MarkdownV2",
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      console.error("Telegram notification failed", { status: response.status });
      return false;
    }

    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || !("ok" in result) || result.ok !== true) {
      console.error("Telegram rejected a notification request.");
      return false;
    }
    return true;
  } catch (error) {
    console.error("Telegram notification request failed", {
      error: error instanceof Error ? error.message : "Unknown Telegram error",
    });
    return false;
  }
}

export function supportTicketKeyboard(ticketId: string, status: string, priority: string) {
  const statusAction = status === "Closed" ? "reopen" : "close";
  const statusLabel = status === "Closed" ? "Reopen" : "Close";
  return {
    inline_keyboard: [
      [
        { text: "Reply", callback_data: `ticket:reply:${ticketId}` },
        { text: statusLabel, callback_data: `ticket:${statusAction}:${ticketId}` },
      ],
      [
        { text: priority === "Low" ? "✓ Low" : "Low", callback_data: `ticket:priority:${ticketId}:Low` },
        { text: priority === "Medium" ? "✓ Medium" : "Medium", callback_data: `ticket:priority:${ticketId}:Medium` },
        { text: priority === "High" ? "✓ High" : "High", callback_data: `ticket:priority:${ticketId}:High` },
      ],
    ],
  };
}

export function telegramWebhookSecret() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  return token ? createHash("sha256").update(token).digest("hex") : "";
}

export async function ensureTelegramWebhook(origin?: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const baseUrl = process.env.APP_BASE_URL || origin;
  if (!token || !baseUrl) return null;

  const webhookUrl = new URL("/api/telegram/deposits", baseUrl).toString();
  return telegramRequest("setWebhook", {
    url: webhookUrl,
    secret_token: telegramWebhookSecret(),
    allowed_updates: ["callback_query", "message"],
  });
}

export async function sendTelegramMessage({
  chatId = process.env.TELEGRAM_CHAT_ID,
  text,
  replyMarkup,
}: {
  chatId?: string;
  text: string;
  replyMarkup?: unknown;
}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return null;

  return telegramRequest("sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: replyMarkup,
  });
}

export async function sendTelegramAttachment({
  chatId = process.env.TELEGRAM_CHAT_ID,
  caption,
  fileUrl,
  replyMarkup,
}: {
  chatId?: string;
  caption: string;
  fileUrl: string;
  replyMarkup?: unknown;
}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return null;

  const method = /\.(jpg|jpeg|png|webp)(\?|$)/i.test(fileUrl) ? "sendPhoto" : "sendDocument";
  return telegramRequest(method, {
    chat_id: chatId,
    [method === "sendPhoto" ? "photo" : "document"]: fileUrl,
    caption,
    reply_markup: replyMarkup,
  });
}

export async function answerTelegramCallback(callbackQueryId: string, text: string, alert = false) {
  return telegramRequest("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
    show_alert: alert,
  });
}

export async function editTelegramMessageReplyMarkup({
  chatId,
  messageId,
  replyMarkup,
}: {
  chatId: string | number;
  messageId: number;
  replyMarkup?: unknown;
}) {
  return telegramRequest("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: replyMarkup ?? { inline_keyboard: [] },
  });
}

async function telegramRequest(method: string, payload: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

function escapeMarkdown(value: string) {
  return value.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}
