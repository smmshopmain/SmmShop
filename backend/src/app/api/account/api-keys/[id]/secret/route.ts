import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { decryptApiKey } from "@/lib/api-key-crypto";
import { ok, requireUser } from "@/lib/api";
import { ApiKey, getSettings } from "@/models";

function noStoreFail(message: string, status: number) {
  return NextResponse.json(
    { ok: false, message },
    { status, headers: { "cache-control": "no-store, private", pragma: "no-cache" } },
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let authData: Awaited<ReturnType<typeof requireUser>>;
  try {
    authData = await requireUser();
  } catch {
    return noStoreFail("Authentication is required to retrieve an API key.", 401);
  }

  const { auth, dbUser } = authData;
  try {
    if (auth.role !== "user") return noStoreFail("API keys are available to customer accounts only.", 403);
    const settings = await getSettings();
    if (!settings.api.enabled) return noStoreFail("Reseller API is currently disabled.", 503);
    if (dbUser.apiAccessEnabled === false) return noStoreFail("API access is disabled for this account.", 403);

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return noStoreFail("Invalid API key identifier.", 400);
    const apiKey = await ApiKey.findOne({ _id: id, user: auth.id, revokedAt: null })
      .select("encryptedSecret")
      .lean();
    if (!apiKey) return noStoreFail("Active API key not found.", 404);
    if (!apiKey.encryptedSecret) {
      return noStoreFail("This older key cannot be copied again. Regenerate it to enable secure copying.", 409);
    }

    try {
      const secret = decryptApiKey(apiKey.encryptedSecret);
      return ok({ secret }, { headers: { "cache-control": "no-store, private", pragma: "no-cache" } });
    } catch (error) {
      console.error("API key could not be decrypted", {
        keyId: id,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
      return noStoreFail("This API key could not be decrypted. Contact support or regenerate it.", 500);
    }
  } catch (error) {
    console.error("API key retrieval failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return noStoreFail("Unable to retrieve API key.", 500);
  }
}
