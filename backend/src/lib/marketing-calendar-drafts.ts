import { z } from "zod";

const VELONA_CHAT_COMPLETIONS_URL = "https://velona.in/v1/chat/completions";

const draftSchema = z.object({
  email: z.object({
    title: z.string().trim().min(1).max(120),
    subject: z.string().trim().min(1).max(200),
    greeting: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(10000),
    bannerPrompt: z.string().trim().max(1200).default(""),
  }).strict(),
  popup: z.object({
    title: z.string().trim().min(1).max(120),
    message: z.string().trim().min(1).max(2000),
  }).strict(),
}).strict();

export type MarketingCalendarDraft = z.infer<typeof draftSchema>;

export function buildBrandedCampaignImagePrompt(input: {
  brandName: string;
  title: string;
  date: string;
  context: string;
  bannerPrompt: string;
}) {
  return [
    `Create a polished, realistic promotional advertisement image for ${input.brandName}, for ${input.title} on ${input.date}.`,
    `Render the exact shop name "${input.brandName}" as clearly legible text integrated into the design.`,
    "Create a real product-ad composition, not a greeting card. Show relevant social-media marketing visuals. Do not invent prices, discounts, guarantees, other brands, or text. No watermark.",
    `Occasion context: ${input.context}.`,
    input.bannerPrompt,
  ].join("\n");
}

export async function generateMarketingCalendarDraft(input: {
  title: string;
  date: string;
  category: string;
  description: string;
  instructions: string;
  brandName: string;
  generateBanner?: boolean;
}): Promise<MarketingCalendarDraft> {
  const apiKey = process.env.VELONA_API_KEY?.trim();
  if (!apiKey) throw new Error("Set VELONA_API_KEY in the backend environment before generating campaigns.");

  const response = await fetch(VELONA_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "Create a truthful, polished marketing email and concise website popup for a social-media marketing shop. Respect the administrator's campaign instructions, but never invent prices, discounts, guarantees, or service capabilities. Always mention the exact shop name in the email body. Return only JSON with email {title, subject, greeting, body, bannerPrompt} and popup {title, message}. Include the occasion name and date naturally.",
            input.generateBanner === false
              ? "Banner generation is disabled for this campaign. Do not write a banner prompt or create banner content."
              : "The bannerPrompt must describe a real promotional advertisement, not a greeting card, and ask for the exact shop name as legible text; do not request any other text, price, logo, or watermark unless explicitly supplied by the administrator.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify({
            event: input.title,
            date: input.date,
            category: input.category,
            eventNotes: input.description,
            shopName: input.brandName,
            administratorInstructions: input.instructions || "No additional instructions.",
            requirements: "Use {{name}} in the personalized greeting. Use the exact shop name as written. Keep the offer factual and the promotion respectful.",
          }),
        },
      ],
    }),
  });
  const result = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(result.error?.message || `AI provider returned status ${response.status}.`);
  }

  const content = result.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI provider returned an empty campaign draft.");
  const jsonContent = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const draft = draftSchema.parse(JSON.parse(jsonContent));
  if (input.generateBanner !== false && !draft.email.bannerPrompt) {
    throw new Error("AI provider returned a campaign draft without an image prompt.");
  }
  return draft;
}
