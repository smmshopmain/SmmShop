import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody, requireAdmin } from "@/lib/api";
import { ensureDefaultProviderFromEnv } from "@/lib/provider";
import { Provider, Order, AuditLog } from "@/models";

const schema = z.object({
  name: z.string().min(2),
  apiUrl: z.url(),
  apiKey: z.string().min(3),
  priority: z.number().int().min(1).default(1),
  enabled: z.boolean().default(true),
});

export async function GET() {
  try {
    await requireAdmin();
    await ensureDefaultProviderFromEnv();
    const providers = await Provider.find().sort({ priority: 1 }).lean();
    return ok({ providers });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load providers", 403);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { auth } = await requireAdmin();
    const input = await parseBody(request, schema);
    const provider = await Provider.create(input);
    await AuditLog.create({ actor: auth.id, action: "provider.create", entity: "Provider", entityId: provider._id });
    return ok({ provider });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to save provider");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { auth } = await requireAdmin();
    const body = await request.json();
    const id = z.string().parse(body.id);
    const input = schema.partial().parse(body);
    const before = await Provider.findById(id).lean();
    const provider = await Provider.findByIdAndUpdate(id, input, { new: true });
    await AuditLog.create({ actor: auth.id, action: "provider.update", entity: "Provider", entityId: id, before, after: provider });
    return ok({ provider });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update provider");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { auth } = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return fail("Provider id is required");
    const activeOrders = await Order.countDocuments({
      provider: id,
      status: { $in: ["Pending", "Processing", "In Progress"] },
    });
    if (activeOrders > 0) return fail("Provider has active orders and cannot be deleted", 409);
    const provider = await Provider.findByIdAndDelete(id);
    await AuditLog.create({ actor: auth.id, action: "provider.delete", entity: "Provider", entityId: id, before: provider });
    return ok({ deleted: true });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to delete provider");
  }
}
