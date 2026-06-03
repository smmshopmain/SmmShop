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

function escapeMarkdown(value: string) {
  return value.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}
