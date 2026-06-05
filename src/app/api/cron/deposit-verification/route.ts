import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireCronOrAdmin } from "@/lib/cron";
import { dbConnect } from "@/lib/db";
import { verifyPendingAutomaticDeposits } from "@/lib/deposits";

export async function GET(request: NextRequest) {
  const authError = await requireCronOrAdmin(request);
  if (authError) return authError;

  try {
    await dbConnect();
    const result = await verifyPendingAutomaticDeposits();
    return ok(result);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Deposit verification failed");
  }
}
