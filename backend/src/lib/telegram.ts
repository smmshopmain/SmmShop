import { createHash } from "node:crypto";

function telegramBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
}

function telegramNotificationChatId() {
  return process.env.TELEGRAM_CHAT_ID?.trim() || process.env.TELEGRAM_ADMIN_ID?.trim() || "";
}

export async function notifyTelegram(title: string, lines: string[] = [], replyMarkup?: unknown) {
  const token = telegramBotToken();
  const chatId = telegramNotificationChatId();
  if (!token || !chatId) {
    console.error("Telegram notification skipped because required configuration is missing.", {
      botTokenConfigured: Boolean(token),
      chatIdConfigured: Boolean(chatId),
    });
    return false;
  }

  const text = [`*${escapeMarkdown(title)}*`, ...lines.map(escapeMarkdown)].join("\n");
  const result = await telegramRequest("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "MarkdownV2",
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
  return result?.ok === true;
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
      [{ text: "⬅️ Back to tickets", callback_data: `ticket:back:${ticketId}` }],
    ],
  };
}

export function telegramWebhookSecret() {
  const token = telegramBotToken();
  return token ? createHash("sha256").update(token).digest("hex") : "";
}

export async function ensureTelegramWebhook(origin?: string) {
  const token = telegramBotToken();
  const baseUrl = process.env.APP_BASE_URL || origin;
  if (!token || !baseUrl) {
    console.error("Telegram webhook setup skipped because required configuration is missing.", {
      botTokenConfigured: Boolean(token),
      baseUrlConfigured: Boolean(baseUrl),
    });
    return null;
  }

  const webhookUrl = new URL("/api/telegram/deposits", baseUrl).toString();
  return telegramRequest("setWebhook", {
    url: webhookUrl,
    secret_token: telegramWebhookSecret(),
    allowed_updates: ["callback_query", "message"],
  });
}

export async function sendTelegramMessage({
  chatId = telegramNotificationChatId(),
  text,
  replyMarkup,
}: {
  chatId?: string;
  text: string;
  replyMarkup?: unknown;
}) {
  const token = telegramBotToken();
  if (!token || !chatId) {
    console.error("Telegram message skipped because required configuration is missing.", {
      botTokenConfigured: Boolean(token),
      chatIdConfigured: Boolean(chatId),
    });
    return null;
  }

  return telegramRequest("sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: replyMarkup,
  });
}

export async function sendTelegramAttachment({
  chatId = telegramNotificationChatId(),
  caption,
  fileUrl,
  replyMarkup,
}: {
  chatId?: string;
  caption: string;
  fileUrl: string;
  replyMarkup?: unknown;
}) {
  const token = telegramBotToken();
  if (!token || !chatId) {
    console.error("Telegram attachment skipped because required configuration is missing.", {
      botTokenConfigured: Boolean(token),
      chatIdConfigured: Boolean(chatId),
    });
    return null;
  }

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

type TelegramApiResponse = {
  ok: boolean;
  description?: string;
  error_code?: number;
  result?: unknown;
};

async function telegramRequest(method: string, payload: Record<string, unknown>): Promise<TelegramApiResponse | null> {
  const token = telegramBotToken();
  if (!token) {
    console.error("Telegram API request skipped because TELEGRAM_BOT_TOKEN is not configured.", { method });
    return null;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    const result = await response.json().catch(() => null) as TelegramApiResponse | null;
    if (!response.ok || !result || result.ok !== true) {
      console.error("Telegram API request failed.", {
        method,
        status: response.status,
        errorCode: result?.error_code,
        description: result?.description ?? "Telegram returned an unreadable response.",
      });
      return result;
    }
    return result;
  } catch (error) {
    console.error("Telegram API request could not be completed.", {
      method,
      error: error instanceof Error ? error.message : "Unknown Telegram error",
    });
    return null;
  }
}

function escapeMarkdown(value: string) {
  return value.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}
