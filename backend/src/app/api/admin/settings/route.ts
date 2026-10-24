import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, requireAdmin } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { DEFAULT_ENABLED_LOADING_ANIMATIONS, LOADING_ANIMATION_IDS } from "@/lib/loading-animations";
import { getSettings, Setting } from "@/models";

const schema = z.object({
  key: z.enum(["appearance", "pricing", "deposits", "provider", "auth", "referrals"]),
  value: z.record(z.string(), z.unknown()),
});

const appearanceSchema = z.object({
  designPreset: z.enum(["default", "studio", "orbit", "atelier", "pulse", "midnight"]).default("default"),
  animationsEnabled: z.boolean(),
  entranceEnabled: z.boolean(),
  floatingEnabled: z.boolean(),
  hoverEnabled: z.boolean(),
  animationColor: z.string().regex(/^#[\da-fA-F]{6}$/),
  animationSpeed: z.number().min(0.5).max(2),
  loadingAnimationsEnabled: z.boolean().default(true),
  loadingAnimationMode: z.enum(["random", "specific"]).default("random"),
  selectedLoadingAnimation: z.enum(LOADING_ANIMATION_IDS).default(LOADING_ANIMATION_IDS[0]),
  enabledLoadingAnimations: z.array(z.enum(LOADING_ANIMATION_IDS)).default(DEFAULT_ENABLED_LOADING_ANIMATIONS),
}).superRefine((appearance, context) => {
  if (appearance.animationsEnabled && appearance.loadingAnimationsEnabled && appearance.enabledLoadingAnimations.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["enabledLoadingAnimations"],
      message: "Enable at least one loading animation, or turn loading animations off.",
    });
  }
  if (
    appearance.animationsEnabled
    && appearance.loadingAnimationsEnabled
    && appearance.loadingAnimationMode === "specific"
    && !appearance.enabledLoadingAnimations.includes(appearance.selectedLoadingAnimation)
  ) {
    context.addIssue({
      code: "custom",
      path: ["selectedLoadingAnimation"],
      message: "The selected loading animation must be enabled.",
    });
  }
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

function normalizeSettingsValue(key: string, value: Record<string, unknown>) {
  if (key === "auth") {
    if (
      value.googleEnabled === true &&
      (!process.env.GOOGLE_CLIENT_ID?.trim() ||
        !process.env.GOOGLE_CLIENT_SECRET?.trim() ||
        !process.env.APP_BASE_URL?.trim())
    ) {
      throw new Error("Configure Google OAuth credentials and APP_BASE_URL in the backend environment first.");
    }
    return { googleEnabled: value.googleEnabled === true };
  }

  if (key === "appearance") {
    const appearance = appearanceSchema.parse(value);
    return {
      ...appearance,
      animationColor: appearance.animationColor.toLowerCase(),
    };
  }

  if (key === "referrals") {
    const commissionPercent = Number(value.commissionPercent ?? 0);
    const commissionAmount = Number(value.commissionAmount ?? 0);
    const minimumReferredWalletAddAmount = Number(value.minimumReferredWalletAddAmount ?? 0);

    return {
      ...value,
      enabled: value.enabled !== false,
      commissionPercent: Number.isFinite(commissionPercent)
        ? Math.max(0, Math.min(100, commissionPercent))
        : 0,
      commissionAmount: Number.isFinite(commissionAmount) ? Math.max(0, commissionAmount) : 0,
      minimumReferredWalletAddAmount: Number.isFinite(minimumReferredWalletAddAmount)
        ? Math.max(0, minimumReferredWalletAddAmount)
        : 0,
    };
  }

  if (key !== "deposits") return value;

  const minimumWalletAddAmount = Number(value.minimumWalletAddAmount ?? 0);
  return {
    ...value,
    minimumWalletAddAmount: Number.isFinite(minimumWalletAddAmount)
      ? Math.max(0, minimumWalletAddAmount)
      : 0,
  };
}

export async function GET() {
  try {
    await requireAdmin();
    await dbConnect();
    const settings = await getSettings();
    return ok({
      ...settings,
      auth: {
        ...settings.auth,
        googleConfigured:
          Boolean(process.env.GOOGLE_CLIENT_ID?.trim()) &&
          Boolean(process.env.GOOGLE_CLIENT_SECRET?.trim()) &&
          Boolean(process.env.APP_BASE_URL?.trim()),
      },
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load settings", 403);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
    await dbConnect();
    const input = schema.parse(await request.json());
    const existing = await Setting.findOne({ key: input.key }).lean();
    const value = mergeSettingsValue(input.key, existing?.value, normalizeSettingsValue(input.key, input.value));
    const setting = await Setting.findOneAndUpdate(
      { key: input.key },
      { value },
      { upsert: true, new: true },
    );
    if (input.key === "deposits") {
      revalidatePath("/api/payment-details");
    }
    return ok({ setting });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to save settings");
  }
}
