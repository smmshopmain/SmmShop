export async function notifyTelegram(title: string, lines: string[] = []) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const text = [`*${escapeMarkdown(title)}*`, ...lines.map(escapeMarkdown)].join("\n");

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "MarkdownV2",
    }),
  }).catch(() => undefined);
}

export async function ensureTelegramWebhook(origin?: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const baseUrl = process.env.APP_BASE_URL || origin;
  if (!token || !baseUrl) return null;

  const webhookUrl = new URL("/api/telegram/deposits", baseUrl).toString();
  return telegramRequest("setWebhook", {
    url: webhookUrl,
    allowed_updates: ["callback_query"],
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
