"use client";

import Link from "next/link";
import {
  BadgeIndianRupee,
  ClipboardList,
  CircleHelp,
  Gauge,
  History,
  Layers3,
  LineChart,
  Bell,
  RefreshCcw,
  Settings,
  Shield,
  Tags,
  Ticket,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiJson, apiUrl } from "@/lib/client-api";

const userLinks = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/dashboard/services", label: "Services", icon: Layers3 },
  { href: "/dashboard/orders", label: "Orders", icon: History },
  { href: "/dashboard/refills", label: "Refills", icon: RefreshCcw },
  { href: "/dashboard/wallet", label: "Wallet", icon: Wallet },
  { href: "/dashboard/referrals", label: "Referrals", icon: BadgeIndianRupee },
  { href: "/dashboard/tickets", label: "Tickets", icon: Ticket },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
  { href: "/dashboard/profile", label: "Profile", icon: UserRound },
];

const adminLinks = [
  { href: "/admin", label: "Admin", icon: Shield },
  { href: "/admin/providers", label: "Providers", icon: Layers3 },
  { href: "/admin/services", label: "Service Admin", icon: Layers3 },
  { href: "/admin/orders", label: "Orders", icon: History },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/deposits", label: "Deposits", icon: CircleHelp },
  { href: "/admin/settings#payment-details", label: "Payment Settings", icon: Wallet },
  { href: "/admin/promo-codes", label: "Promo Codes", icon: Tags },
  { href: "/admin/tickets", label: "Support", icon: Ticket },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
  { href: "/admin/analytics", label: "Analytics", icon: LineChart },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: ClipboardList },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<{ email?: string; role?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    apiJson("/api/auth/me")
      .then((data) => {
        if (!mounted) return;
        const user = data?.user ?? (data?.ok ? data : null);
        setUser(user);
      })
      .catch(() => {
        if (mounted) {
          setUser(null);
          router.push("/login");
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [router]);

  const links = user?.role === "admin" ? [...userLinks, ...adminLinks] : userLinks;

  async function logout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await fetch(apiUrl("/api/auth/logout"), {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore failure and still redirect to login
    }
    router.push("/login");
  }

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-64 overflow-y-auto border-r border-neutral-200 bg-white px-4 py-5 lg:block">
        <Link href="/dashboard" className="flex items-center gap-3 px-2">
          <span className="grid size-10 place-items-center rounded-md bg-teal-700 text-sm font-bold text-white">
            SP
          </span>
          <span>
            <span className="block text-sm font-semibold">SMM Panel</span>
            <span className="block text-xs text-neutral-500">Reseller platform</span>
          </span>
        </Link>
        <nav className="mt-8 space-y-1 pb-6">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href as any}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-amber-50 hover:text-neutral-950"
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 px-3 py-3 backdrop-blur sm:px-4">
          <div className="mx-auto grid max-w-7xl gap-3">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <Link href="/dashboard" className="shrink-0 font-semibold lg:hidden">
                SMM Panel
              </Link>
              <div className="ml-auto flex min-w-0 items-center gap-2 text-sm sm:gap-3">
                <span className="hidden truncate text-neutral-600 sm:block">{loading ? "Loading..." : user?.email ?? ""}</span>
                <form onSubmit={logout} className="shrink-0">
                  <button className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100">
                    Logout
                  </button>
                </form>
              </div>
            </div>
            <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:hidden">
              {links.map((item) => (
                <Link
                  key={item.href}
                  href={item.href as any}
                  className="inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-amber-50 hover:text-neutral-950"
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto min-w-0 max-w-7xl px-3 py-5 sm:px-6 sm:py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
