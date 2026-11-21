import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { fail, ok, parseBody, requireUser } from "@/lib/api";
import { generateResellerApiKey } from "@/lib/reseller-api";
import { ApiKey, getSettings } from "@/models";

const createSchema = z.object({
  name: z.string().trim().min(1).max(60).default("My API key"),
  replaceKeyId: z.string().optional(),
});

export async function GET() {
  try {
    const { auth, dbUser } = await requireUser();
    if (auth.role !== "user") return fail("Reseller API keys are available to customer accounts only.", 403);
    const settings = await getSettings();
    if (!settings.api.enabled) return fail("Reseller API is currently disabled.", 503);
    if (dbUser.apiAccessEnabled === false) return fail("API access is disabled for this account.", 403);
    const keys = await ApiKey.find({ user: auth.id })
      .select("name prefix revokedAt lastUsedAt createdAt")
      .sort({ createdAt: -1 })
      .lean();
    return ok({
      keys,
      enabled: true,
      maxKeys: settings.api.maxKeysPerUser,
      activeCount: keys.filter((key) => !key.revokedAt).length,
      baseUrl: process.env.APP_BASE_URL?.replace(/\/+$/, "") ?? "",
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load API keys", 401);
  }
}

export async function POST(request: NextRequest) {
  let session: mongoose.ClientSession | null = null;
  try {
    const { auth, dbUser } = await requireUser();
    if (auth.role !== "user") return fail("Reseller API keys are available to customer accounts only.", 403);
    const transactionSession = await mongoose.startSession();
    session = transactionSession;
    const settings = await getSettings();
    if (!settings.api.enabled) return fail("Reseller API is currently disabled.", 503);
    if (dbUser.apiAccessEnabled === false) return fail("API access is disabled for this account.", 403);
    const input = await parseBody(request, createSchema);
    if (input.replaceKeyId && !mongoose.isValidObjectId(input.replaceKeyId)) {
      return fail("Invalid API key identifier.", 400);
    }

    const activeCount = await ApiKey.countDocuments({ user: auth.id, revokedAt: null });
    if (!input.replaceKeyId && activeCount >= settings.api.maxKeysPerUser) {
      return fail("You have reached the maximum number of active API keys.", 409);
    }
    if (input.replaceKeyId) {
      const oldKey = await ApiKey.findOne({ _id: input.replaceKeyId, user: auth.id, revokedAt: null }).lean();
      if (!oldKey) return fail("Active API key not found.", 404);
    }

    const generated = generateResellerApiKey();
    let newKey: { _id: mongoose.Types.ObjectId; name: string; prefix: string; createdAt: Date } | null = null;
    await transactionSession.withTransaction(async () => {
      if (input.replaceKeyId) {
        const revoked = await ApiKey.updateOne(
          { _id: input.replaceKeyId, user: auth.id, revokedAt: null },
          { $set: { revokedAt: new Date() } },
          { session: transactionSession },
        );
        if (revoked.modifiedCount !== 1) throw new Error("The API key is no longer active.");
      }
      const [created] = await ApiKey.create([{
        user: auth.id,
        name: input.name,
        prefix: generated.prefix,
        secretHash: generated.secretHash,
      }], { session: transactionSession });
      newKey = {
        _id: created._id,
        name: created.name,
        prefix: created.prefix,
        createdAt: created.createdAt,
      };
    });

    if (!newKey) return fail("Unable to create API key.", 500);
    return ok({ key: newKey, secret: generated.secret }, { status: 201 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to create API key");
  } finally {
    await session?.endSession();
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { auth, dbUser } = await requireUser();
    if (auth.role !== "user") return fail("Reseller API keys are available to customer accounts only.", 403);
    const settings = await getSettings();
    if (!settings.api.enabled) return fail("Reseller API is currently disabled.", 503);
    if (dbUser.apiAccessEnabled === false) return fail("API access is disabled for this account.", 403);
    const input = await parseBody(request, z.object({ id: z.string().min(1) }));
    if (!mongoose.isValidObjectId(input.id)) return fail("Invalid API key identifier.", 400);
    const key = await ApiKey.findOneAndUpdate(
      { _id: input.id, user: auth.id, revokedAt: null },
      { $set: { revokedAt: new Date() } },
      { new: true },
    ).select("name prefix revokedAt");
    if (!key) return fail("Active API key not found.", 404);
    return ok({ key });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to revoke API key");
  }
}
