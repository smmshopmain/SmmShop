import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody, requireUser } from "@/lib/api";
import { PromoCode } from "@/models";
import { roundMoney } from "@/lib/pricing";

const schema = z.object({
  code: z.string().min(2),
  amount: z.number().min(0),
});

export async function POST(request: NextRequest) {
  try {
    await requireUser();
    const { code, amount } = await parseBody(request, schema);
    const promo = await PromoCode.findOne({ code: code.toUpperCase(), active: true });
    if (!promo) return fail("Invalid promo code", 404);
    if (promo.expiresAt && promo.expiresAt < new Date()) return fail("Promo code expired");
    if (promo.maxUses && promo.usedCount >= promo.maxUses) return fail("Promo code limit reached");
    if (amount < promo.minOrderAmount) return fail("Order does not meet minimum promo amount");

    const discount =
      promo.discountType === "percent"
        ? roundMoney((amount * promo.discountValue) / 100)
        : Math.min(amount, promo.discountValue);
    return ok({ code: promo.code, discount });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to apply promo");
  }
}
