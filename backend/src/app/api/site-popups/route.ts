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
        .limit(100)
        .select("title kind message emoji imageUrl linkType linkHref linkLabel startsAt expiresAt autoCloseAfterSeconds slideshowGroupId showOnEveryRefresh")
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
    const groupIds = new Set(popups.map((popup) => popup.slideshowGroupId).filter(Boolean));
    const groupBases = groupIds.size
      ? await SitePopup.find({ _id: { $in: [...groupIds] } }).select("_id autoCloseAfterSeconds").lean()
      : [];
    const baseDurationById = new Map(groupBases.map((popup) => [String(popup._id), popup.autoCloseAfterSeconds ?? 0]));
    const groupSizeById = new Map<string, number>();
    const popupsByGroupId = new Map<string, typeof popups>();
    let standaloneCount = 0;
    for (const popup of popups) {
      const popupId = String(popup._id);
      const groupId = popup.slideshowGroupId || (groupIds.has(popupId) ? popupId : "");
      if (groupId) {
        groupSizeById.set(groupId, (groupSizeById.get(groupId) ?? 0) + 1);
      } else {
        standaloneCount += 1;
      }
      const sequenceId = groupId || popupId;
      const members = popupsByGroupId.get(sequenceId) ?? [];
      members.push(popup);
      popupsByGroupId.set(sequenceId, members);
    }
    const orderedPopups = [...popupsByGroupId.entries()].flatMap(([groupId, members]) =>
      members.sort((first, second) =>
        Number(String(second._id) === groupId) - Number(String(first._id) === groupId),
      ),
    );
    const popupsWithDisplayTime = orderedPopups.map((popup) => {
      const popupId = String(popup._id);
      const groupId = popup.slideshowGroupId || (groupIds.has(popupId) ? popupId : "");
      if (groupId) {
        const groupDuration = baseDurationById.get(groupId) || slideshowDurationSeconds;
        return {
          ...popup,
          displayDurationSeconds: groupDuration / Math.max(groupSizeById.get(groupId) ?? 1, 1),
        };
      }
      const customDuration = popup.autoCloseAfterSeconds ?? 0;
      return {
        ...popup,
        displayDurationSeconds: customDuration > 0
          ? customDuration
          : slideshowDurationSeconds / Math.max(standaloneCount, 1),
      };
    });
    return ok({ popups: popupsWithDisplayTime, slideshowDurationSeconds });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load announcements", 500);
  }
}
