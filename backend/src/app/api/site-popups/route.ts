import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { Setting, SitePopup } from "@/models";

const DEFAULT_SLIDESHOW_DURATION_SECONDS = 10;
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const now = new Date();
    const after = request.nextUrl.searchParams.get("after");
    const excludedIds = after?.split(",").filter((id) => /^[a-f\d]{24}$/i.test(id)) ?? [];
    const [popups, slideshowSetting] = await Promise.all([
      SitePopup.find({
        active: true,
        startsAt: { $lte: now },
        expiresAt: { $gt: now },
        ...(excludedIds.length ? { _id: { $nin: excludedIds } } : {}),
      })
        .sort({ startsAt: 1, createdAt: -1 })
        .limit(20)
        .select("title kind message emoji imageUrl linkType linkHref linkLabel startsAt expiresAt autoCloseAfterSeconds showOnEveryRefresh")
        .lean(),
      Setting.findOne({ key: "popupSlideshow" }).select("value").lean(),
    ]);
    const storedDuration = (slideshowSetting?.value as { durationSeconds?: unknown } | undefined)?.durationSeconds;
    const slideshowDurationSeconds = typeof storedDuration === "number"
      && Number.isInteger(storedDuration)
      && storedDuration >= 3
      && storedDuration <= 3600
      ? storedDuration
      : DEFAULT_SLIDESHOW_DURATION_SECONDS;
    return ok({ popups, slideshowDurationSeconds });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load announcements", 500);
  }
}
