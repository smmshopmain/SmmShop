import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { SitePopup } from "@/models";

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const now = new Date();
    const after = request.nextUrl.searchParams.get("after");
    const excludedIds = after?.split(",").filter((id) => /^[a-f\d]{24}$/i.test(id)) ?? [];
    const popups = await SitePopup.find({
      active: true,
      startsAt: { $lte: now },
      expiresAt: { $gt: now },
      ...(excludedIds.length ? { _id: { $nin: excludedIds } } : {}),
    })
      .sort({ startsAt: 1, createdAt: -1 })
      .limit(20)
      .select("title kind message emoji linkHref linkLabel startsAt expiresAt")
      .lean();
    return ok({ popups });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load announcements", 500);
  }
}
