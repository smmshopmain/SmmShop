import mongoose from "mongoose";
import { fail, ok } from "@/lib/api";
import { dbConnect } from "@/lib/db";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return fail("Keep-alive authentication is not configured", 503);
  }
  if (request.headers.get("x-cron-secret") !== cronSecret) {
    return fail("Unauthorized", 401);
  }

  try {
    await dbConnect();
    const database = mongoose.connection.db;
    if (!database) {
      throw new Error("MongoDB connection is not ready");
    }
    await database.admin().ping();

    return ok({
      awake: true,
      mongo: "ok",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Keep-alive check failed", error);
    return fail("Backend or MongoDB keep-alive check failed", 503);
  }
}
