import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, requireAdmin } from "@/lib/api";
import { getSettings, Setting } from "@/models";

const schema = z.object({
  key: z.enum(["pricing", "deposits", "provider", "referrals"]),
  value: z.record(z.string(), z.unknown()),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasPaymentDetail(value: unknown) {
  return isRecord(value) && Object.values(value).some((entry) => String(entry ?? "").trim() !== "");
}

function mergeSettingsValue(key: string, existingValue: unknown, nextValue: Record<string, unknown>) {
  if (!isRecord(existingValue)) return nextValue;

  const merged: Record<string, unknown> = { ...existingValue, ...nextValue };
  if (key !== "deposits") return merged;

  const existingPayment = isRecord(existingValue.payment) ? existingValue.payment : {};
  const nextPayment = isRecord(nextValue.payment) ? nextValue.payment : null;
  if (!nextPayment) return merged;

  merged.payment =
    hasPaymentDetail(existingPayment) && !hasPaymentDetail(nextPayment)
      ? existingPayment
      : { ...existingPayment, ...nextPayment };
  return merged;
}

export async function GET() {
  try {
    await requireAdmin();
    return ok(await getSettings());
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load settings", 403);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
    const input = schema.parse(await request.json());
    const existing = await Setting.findOne({ key: input.key }).lean();
    const value = mergeSettingsValue(input.key, existing?.value, input.value);
    const setting = await Setting.findOneAndUpdate(
      { key: input.key },
      { value },
      { upsert: true, returnDocument: "after" },
    );
    return ok({ setting });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to save settings");
  }
}
