import mongoose from "mongoose";
import { ok, fail } from "@/lib/api";
import { dbConnect } from "@/lib/db";

export async function GET() {
  try {
    await dbConnect();
    return ok({
      status: "healthy",
      mongo: mongoose.connection.readyState,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Health check failed", 503);
  }
}
