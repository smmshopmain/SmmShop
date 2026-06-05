import { NextRequest, NextResponse } from "next/server";
import { fail, requireAdmin } from "@/lib/api";
import { Order } from "@/models";

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const match: Record<string, unknown> = {};
    const createdAt: Record<string, Date> = {};
    if (from) createdAt.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      createdAt.$lte = end;
    }
    if (Object.keys(createdAt).length) match.createdAt = createdAt;

    const orders = await Order.find(match)
      .populate("user", "email")
      .populate("service", "name category")
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean();

    const header = ["date", "order_id", "user", "service", "status", "quantity", "revenue", "profit"];
    const rows = orders.map((order) => [
      new Date(order.createdAt).toISOString(),
      order._id,
      order.user?.email,
      order.service?.name,
      order.status,
      order.quantity,
      order.sellingPrice,
      order.profit,
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");

    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": "attachment; filename=analytics-orders.csv",
      },
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to export analytics", 403);
  }
}
