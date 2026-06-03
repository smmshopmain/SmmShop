import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody, requireUser } from "@/lib/api";
import { calculateOrderPrice } from "@/lib/pricing";
import { addProviderOrder, getEnabledProviders } from "@/lib/provider";
import { notifyTelegram } from "@/lib/telegram";
import { Order, PromoCode, Service, WalletTransaction } from "@/models";
import { roundMoney } from "@/lib/pricing";

const schema = z.object({
  serviceId: z.string().min(1),
  link: z.url(),
  quantity: z.number().int().positive(),
  warningAccepted: z.literal(true),
  promoCode: z.string().trim().min(2).optional(),
});

export async function GET() {
  try {
    const { auth } = await requireUser();
    const orders = await Order.find({ user: auth.id })
      .populate("service", "name category")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return ok({ orders });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load orders", 401);
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = await parseBody(request, schema);
    const { auth, dbUser } = await requireUser();
    if (dbUser.walletFrozen) return fail("Wallet is frozen", 403);

    const service = await Service.findById(input.serviceId).populate("provider").lean();
    if (!service || !service.active) return fail("Service is unavailable", 404);
    if (input.quantity < service.min || input.quantity > service.max) {
      return fail(`Quantity must be between ${service.min} and ${service.max}`);
    }

    const providerCost = calculateOrderPrice(service.providerRate, input.quantity);
    const grossSellingPrice = calculateOrderPrice(service.sellingRate, input.quantity);
    let promoDiscount = 0;
    let promo = null;
    if (input.promoCode) {
      promo = await PromoCode.findOne({ code: input.promoCode.toUpperCase(), active: true });
      if (!promo) return fail("Invalid promo code", 404);
      if (promo.expiresAt && promo.expiresAt < new Date()) return fail("Promo code expired");
      if (promo.maxUses && promo.usedCount >= promo.maxUses) return fail("Promo code limit reached");
      if (grossSellingPrice < promo.minOrderAmount) return fail("Order does not meet minimum promo amount");
      promoDiscount =
        promo.discountType === "percent"
          ? roundMoney((grossSellingPrice * promo.discountValue) / 100)
          : Math.min(grossSellingPrice, promo.discountValue);
    }
    const sellingPrice = Math.max(0, roundMoney(grossSellingPrice - promoDiscount));
    if (dbUser.walletBalance < sellingPrice) return fail("Insufficient wallet balance", 402);

    const balanceBefore = dbUser.walletBalance;
    dbUser.walletBalance -= sellingPrice;
    await dbUser.save();

    const providers = await getEnabledProviders();
    const orderedProviders = [
      service.provider,
      ...providers.filter((provider) => String(provider._id) !== String(service.provider._id)),
    ];

    let providerResult;
    try {
      providerResult = await addProviderOrder(orderedProviders, {
        service: service.providerServiceId,
        link: input.link,
        quantity: input.quantity,
      });
    } catch (error) {
      dbUser.walletBalance = balanceBefore;
      await dbUser.save();
      throw error;
    }

    const order = await Order.create({
      user: auth.id,
      service: service._id,
      provider: providerResult.provider._id,
      providerOrderId: String(providerResult.result.order),
      link: input.link,
      quantity: input.quantity,
      status: "Pending",
      providerCost,
      sellingPrice,
      promoCode: promo?.code,
      promoDiscount,
      profit: sellingPrice - providerCost,
      warningAcceptedAt: new Date(),
      providerResponse: providerResult.result,
    });

    await WalletTransaction.create({
      user: auth.id,
      type: "debit",
      amount: sellingPrice,
      balanceBefore,
      balanceAfter: dbUser.walletBalance,
      source: "order",
      reference: String(order._id),
    });
    if (promo) {
      promo.usedCount += 1;
      await promo.save();
      await WalletTransaction.create({
        user: auth.id,
        type: "promo",
        amount: promoDiscount,
        balanceBefore: dbUser.walletBalance,
        balanceAfter: dbUser.walletBalance,
        source: "promo_code",
        reference: promo.code,
      });
    }

    await notifyTelegram("New Order", [
      `User: ${auth.email}`,
      `Order: ${order._id}`,
      `Amount: ${sellingPrice}`,
    ]);

    return ok({ order });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to place order");
  }
}
