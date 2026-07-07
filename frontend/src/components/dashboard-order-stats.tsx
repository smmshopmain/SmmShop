"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, ShoppingBag } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { apiJson } from "@/lib/client-api";

type OrderSummary = {
  totalOrders: number;
  activeOrders: number;
  completedOrders: number;
};

const activeStatuses = new Set(["Pending", "Processing", "In Progress"]);

function getOrderSummary(orders: Array<{ status?: string }>): OrderSummary {
  return {
    totalOrders: orders.length,
    activeOrders: orders.filter((order) => activeStatuses.has(order.status ?? "")).length,
    completedOrders: orders.filter((order) => order.status === "Completed").length,
  };
}

export function DashboardOrderStats({ initialSummary }: { initialSummary: OrderSummary }) {
  const [summary, setSummary] = useState(initialSummary);

  useEffect(() => {
    let active = true;

    async function refreshOrders() {
      try {
        const result = await apiJson("/api/orders?sync=1", { cache: "no-store" });
        const orders = Array.isArray(result.orders)
          ? result.orders
          : Array.isArray(result.data?.orders)
          ? result.data.orders
          : [];
        if (active) setSummary(getOrderSummary(orders));
      } catch {
        // Keep the server-rendered summary if the live refresh fails.
      }
    }

    refreshOrders();
    const intervalId = window.setInterval(refreshOrders, 15000);
    window.addEventListener("focus", refreshOrders);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshOrders);
    };
  }, []);

  return (
    <>
      <StatCard label="Total Orders" value={summary.totalOrders} icon={ShoppingBag} tone="neutral" />
      <StatCard label="Active Orders" value={summary.activeOrders} icon={Clock3} tone="amber" />
      <StatCard label="Completed Orders" value={summary.completedOrders} icon={CheckCircle2} tone="teal" />
    </>
  );
}
