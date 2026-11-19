import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, requireAdmin } from "@/lib/api";
import { CAMPAIGN_BANNER_PRESETS, suggestCampaignBannerPreset } from "@/lib/campaign-banners";
import { dbConnect } from "@/lib/db";
import { buildBrandedCampaignImagePrompt, generateMarketingCalendarDraft } from "@/lib/marketing-calendar-drafts";
import { generateVelonaCampaignImage } from "@/lib/velona-image-generation";
import { EmailCampaign, getSettings } from "@/models";

const requestSchema = z.object({
  title: z.string().trim().min(1).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Choose a valid calendar date."),
  category: z.enum(["festival", "promotion", "announcement", "other"]),
  description: z.string().trim().max(1000).default(""),
  instructions: z.string().trim().max(2000).default(""),
  calendarEventKey: z.string().trim().min(1).max(280)
    .regex(/^(?:google|admin):[A-Za-z\d._-]{1,240}:\d{4}-\d{2}-\d{2}$/),
}).strict();

export async function POST(request: NextRequest) {
  try {
    const { auth } = await requireAdmin();
    await dbConnect();
    const input = requestSchema.parse(await request.json());
    if (await EmailCampaign.exists({ calendarEventKey: input.calendarEventKey })) {
      return ok({ alreadyScheduled: true });
    }
    const settings = await getSettings();
    if (!settings.ai.enabled || !process.env.VELONA_API_KEY?.trim()) {
      return fail("Enable the AI assistant and configure VELONA_API_KEY before generating campaign drafts.", 400);
    }

    const drafts = await generateMarketingCalendarDraft({
      title: input.title,
      date: input.date,
      category: input.category,
      description: input.description,
      instructions: input.instructions,
      brandName: settings.email.brandName,
    });
    const bannerPresetId = suggestCampaignBannerPreset(
      "advertisement",
      input.title,
      drafts.email.subject,
      drafts.email.body,
    );
    if (!bannerPresetId) throw new Error("Unable to choose a campaign banner design.");
    const bannerPreset = CAMPAIGN_BANNER_PRESETS[bannerPresetId];
    const imageUrl = await generateVelonaCampaignImage({
      prompt: buildBrandedCampaignImagePrompt({
        brandName: settings.email.brandName,
        title: input.title,
        date: input.date,
        context: input.description || input.category,
        bannerPrompt: drafts.email.bannerPrompt,
      }),
      folder: "campaign-banners",
      createdBy: auth.id,
    });

    return ok({
      email: {
        title: drafts.email.title,
        subject: drafts.email.subject,
        greeting: drafts.email.greeting,
        body: drafts.email.body,
        primaryColor: bannerPreset.colors[0],
        accentColor: bannerPreset.colors[1],
        banner: {
          presetId: bannerPresetId,
          imageUrl,
          backgroundImageUrl: "",
          backgroundColor: "",
        },
        calendarEventKey: input.calendarEventKey,
      },
      popup: drafts.popup,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to generate campaign drafts", 400);
  }
}
