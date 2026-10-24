import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";
import { currentUser } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { User } from "@/models";
import { publicOrigin } from "@/lib/request-origin";

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (user?.sessionId) {
    await dbConnect();
    await User.updateOne(
      { _id: user.id, activeSessionId: user.sessionId },
      { $unset: { activeSessionId: 1 } },
    );
  }
  await clearSessionCookie();
  return NextResponse.redirect(new URL("/login", publicOrigin(request)), { status: 303 });
}
