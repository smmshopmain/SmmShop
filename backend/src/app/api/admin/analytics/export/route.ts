import { NextRequest, NextResponse } from "next/server";
import { fail, requireAdmin } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { analyticsDateFilter, InvalidAnalyticsDateRangeError } from "@/lib/analytics";
import { Order, WalletTransaction } from "@/models";

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const match = analyticsDateFilter(searchParams.get("from"), searchParams.get("to"));

    const orders = await Order.find(match)
      .populate("user", "email")
      .populate("service", "name category")
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean();
    const refundedReferences = await WalletTransaction.distinct("reference", {
      type: "refund",
      reference: { $in: orders.map((order) => String(order._id)) },
    });
    const refundedOrderIds = new Set(refundedReferences);

    const header = ["date", "order_id", "user", "service", "status", "quantity", "revenue", "profit"];
    const rows = orders.filter((order) => !refundedOrderIds.has(String(order._id))).map((order) => [
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
    if (error instanceof InvalidAnalyticsDateRangeError) return fail(error.message, 400);
    if (error instanceof Error && error.message === "Unauthorized") return fail(error.message, 401);
    if (error instanceof Error && error.message === "Forbidden") return fail(error.message, 403);
    console.error("Admin analytics export failed.", error);
    return fail("Unable to export analytics", 500);
  }
}
