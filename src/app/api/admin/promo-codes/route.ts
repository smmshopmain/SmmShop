import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody, requireAdmin } from "@/lib/api";
import { AuditLog, PromoCode } from "@/models";

const schema = z.object({
  code: z.string().trim().min(2).max(40),
  discountType: z.enum(["percent", "fixed"]).default("percent"),
  discountValue: z.number().positive(),
  maxUses: z.number().int().positive().optional(),
  minOrderAmount: z.number().min(0).default(0),
  active: z.boolean().default(true),
  expiresAt: z.string().datetime().optional(),
});

export async function GET() {
  try {
    await requireAdmin();
    const promoCodes = await PromoCode.find().sort({ createdAt: -1 }).limit(100).lean();
    return ok({ promoCodes });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load promo codes", 403);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { auth } = await requireAdmin();
    const input = await parseBody(request, schema);
    const promoCode = await PromoCode.create({
      ...input,
      code: input.code.toUpperCase(),
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
    });
    await AuditLog.create({
      actor: auth.id,
      action: "promo.create",
      entity: "PromoCode",
      entityId: String(promoCode._id),
      after: promoCode,
    });
    return ok({ promoCode });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to create promo code");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { auth } = await requireAdmin();
    const body = await request.json();
    const id = z.string().parse(body.id);
    const input = schema.partial().parse(body);
    const before = await PromoCode.findById(id).lean();
    const promoCode = await PromoCode.findByIdAndUpdate(
      id,
      {
        ...input,
        code: input.code ? input.code.toUpperCase() : undefined,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      },
      { new: true },
    );
    await AuditLog.create({
      actor: auth.id,
      action: "promo.update",
      entity: "PromoCode",
      entityId: id,
      before,
      after: promoCode,
    });
    return ok({ promoCode });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update promo code");
  }
}
