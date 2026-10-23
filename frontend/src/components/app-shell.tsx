"use client";

import type { Route } from "next";
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
  LogOut,
  Menu,
  Palette,
  RefreshCcw,
  Settings,
  Shield,
  Tags,
  Ticket,
  AlertTriangle,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiJson, apiUrl } from "@/lib/client-api";
import { isAdminRole } from "@/lib/roles";

type NavItem = {
  href: Route;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const userLinks: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: Gauge },
  { href: "/dashboard/services", label: "Explore", icon: Layers3 },
  { href: "/dashboard/orders", label: "My orders", icon: History },
  { href: "/dashboard/refills", label: "Refills", icon: RefreshCcw },
  { href: "/dashboard/wallet", label: "My wallet", icon: Wallet },
  { href: "/dashboard/referrals", label: "Invite & earn", icon: BadgeIndianRupee },
  { href: "/dashboard/tickets", label: "Get help", icon: Ticket },
  { href: "/dashboard/notifications", label: "Updates", icon: Bell },
  { href: "/dashboard/profile", label: "My account", icon: UserRound },
];

const adminLinks: NavItem[] = [
  { href: "/admin", label: "Admin", icon: Shield },
  { href: "/dashboard/profile", label: "My Profile", icon: UserRound },
  { href: "/admin/providers", label: "Providers", icon: Layers3 },
  { href: "/admin/services", label: "Service Admin", icon: Layers3 },
  { href: "/admin/pricing" as Route, label: "Margins", icon: BadgeIndianRupee },
  { href: "/admin/orders", label: "Orders", icon: History },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/deposits", label: "Deposits", icon: CircleHelp },
  { href: "/admin/settings#payment-details" as Route, label: "Payment Settings", icon: Wallet },
  { href: "/admin/promo-codes", label: "Promo Codes", icon: Tags },
  { href: "/admin/tickets", label: "Support", icon: Ticket },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
  { href: "/admin/analytics", label: "Analytics", icon: LineChart },
  { href: "/admin/errors" as Route, label: "Errors", icon: AlertTriangle },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: ClipboardList },
  { href: "/admin/settings#animation-settings" as Route, label: "Design & motion", icon: Palette },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ email?: string; role?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    apiJson("/api/auth/me")
      .then((data) => {
        if (!mounted) return;
        if (!data?.ok) {
          setUser(null);
          router.replace("/login");
          return;
        }
        const user = data?.user ?? (data?.ok ? data : null);
        setUser(user);
      })
      .catch(() => {
        if (mounted) {
          setUser(null);
          router.replace("/login");
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [router]);

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center px-4" role="status">
        <p className="animate-pulse text-sm font-medium text-neutral-600">Loading your workspace...</p>
      </main>
    );
  }

  if (!user) return null;

  const isAdmin = isAdminRole(user?.role);
  const links = isAdmin ? adminLinks : userLinks;
  const primaryLinks = links.filter((item) =>
    (isAdmin
      ? ["/admin", "/admin/orders", "/admin/deposits", "/admin/users"]
      : ["/dashboard", "/dashboard/services", "/dashboard/orders", "/dashboard/wallet"]
    ).includes(item.href),
  );

  function isActive(href: string) {
    const path = href.split("#", 1)[0];
    if (path === "/dashboard") return pathname === path;
    return pathname === path || pathname.startsWith(`${path}/`);
  }

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
    <div className="app-shell min-h-screen">
      <aside className="app-sidebar fixed inset-y-0 left-0 hidden w-64 overflow-y-auto border-r px-4 py-5 lg:block">
        <Link href={isAdmin ? "/admin" : "/dashboard/services"} className="flex items-center gap-3 px-2">
          <span className="brand-mark grid size-10 place-items-center rounded-xl text-sm font-bold text-white">
            SP
          </span>
          <span>
            <span className="block text-sm font-semibold">{isAdmin ? "Admin Panel" : "SMM Panel"}</span>
            <span className="block text-xs text-neutral-500">{isAdmin ? "Operations console" : "Your growth, made simple"}</span>
          </span>
        </Link>
        <nav className="mt-8 space-y-1 pb-6">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive(item.href)
                  ? "bg-teal-50 text-teal-900 shadow-sm ring-1 ring-teal-700/10"
                  : "text-neutral-600 hover:translate-x-0.5 hover:bg-neutral-100/80 hover:text-neutral-950"
              }`}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 lg:pl-64">
        <header className="app-header sticky top-0 z-20 border-b px-3 py-3 sm:px-4">
          <div className="mx-auto max-w-7xl">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <Link href={isAdmin ? "/admin" : "/dashboard/services"} className="flex min-w-0 items-center gap-2 font-semibold lg:hidden">
                <span className="brand-mark grid size-9 shrink-0 place-items-center rounded-xl text-xs font-bold text-white">SP</span>
                <span className="truncate">{isAdmin ? "Admin Panel" : "SMM Panel"}</span>
              </Link>
              <div className="ml-auto flex min-w-0 items-center gap-2 text-sm sm:gap-3">
                <span className="hidden max-w-72 truncate rounded-full bg-neutral-100 px-3 py-1.5 text-neutral-600 sm:block">
                  {loading ? "Loading..." : user?.email ?? ""}
                </span>
                <form onSubmit={logout} className="shrink-0">
                  <button className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white/80 px-3 py-2 text-sm font-semibold shadow-sm hover:border-neutral-300 hover:bg-white">
                    <LogOut className="size-4" />
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                </form>
                <button
                  type="button"
                  onClick={() => setMenuOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white/80 px-3 py-2 text-sm font-semibold shadow-sm hover:border-neutral-300 hover:bg-white lg:hidden"
                  aria-label="Open menu"
                >
                  <Menu className="size-4" />
                  Menu
                </button>
              </div>
            </div>
          </div>
        </header>
        <main className="page-enter mx-auto min-w-0 max-w-7xl px-3 py-5 pb-24 sm:px-6 sm:py-6 lg:px-8 lg:pb-8">{children}</main>
      </div>

      <nav className="app-header fixed inset-x-0 bottom-0 z-30 border-t px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {primaryLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`grid min-w-0 justify-items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold transition ${
                isActive(item.href) ? "bg-teal-50 text-teal-800" : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              <item.icon className="size-5" />
              <span className="truncate">{item.label}</span>
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="grid min-w-0 justify-items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold text-neutral-600 hover:bg-neutral-100"
          >
            <Menu className="size-5" />
            <span>More</span>
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-neutral-950/40"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <div className="mobile-menu-panel absolute inset-y-0 right-0 flex w-[min(24rem,92vw)] flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-neutral-200 p-4">
              <div className="min-w-0">
                <p className="font-semibold text-neutral-950">Your SMM Panel</p>
                <p className="truncate text-xs text-neutral-500">{loading ? "Loading..." : user?.email ?? "Account"}</p>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="grid size-10 place-items-center rounded-md border border-neutral-300 hover:bg-neutral-100"
                aria-label="Close menu"
              >
                <X className="size-5" />
              </button>
            </div>
            <nav className="grid gap-1 overflow-y-auto p-3">
              {links.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm font-semibold transition ${
                    isActive(item.href)
                      ? "bg-teal-50 text-teal-900"
                      : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950"
                  }`}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
