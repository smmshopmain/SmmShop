import { NextRequest } from "next/server";
import { runResellerApiRequest } from "@/lib/reseller-api";

export async function GET(request: NextRequest) {
  return runResellerApiRequest(request, "rest", {}, "balance.read", async ({ user }) => ({
    balance: Number(user.walletBalance ?? 0),
    currency: "INR",
  }));
}
