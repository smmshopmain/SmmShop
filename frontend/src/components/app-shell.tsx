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
  Mail,
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
  Search,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiJson, apiUrl } from "@/lib/client-api";
import { isAdminRole } from "@/lib/roles";
import { ContentLoading } from "@/components/content-loading";
import { RequiredGooglePhoneModal } from "@/components/required-google-phone-modal";

type NavItem = {
  href: Route;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
};

type WorkspaceHealthState = "checking" | "healthy" | "attention" | "unavailable";

type WorkspaceHealth = {
  state: WorkspaceHealthState;
  label: string;
  detail: string;
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
  { href: "/admin/settings#animation-settings" as Route, label: "Animations", icon: Palette },
  { href: "/admin/email" as Route, label: "Email Management", icon: Mail },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{
    email?: string;
    name?: string;
    role?: string;
    phone?: string;
    requiresPhone?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [workspaceHealth, setWorkspaceHealth] = useState<WorkspaceHealth>({
    state: "checking",
    label: "Checking systems",
    detail: "Checking service and database availability.",
  });
  const isAdmin = isAdminRole(user?.role);

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

  useEffect(() => {
    if (!user) return;

    let mounted = true;
    let timer: ReturnType<typeof setTimeout>;

    async function refreshWorkspaceHealth() {
      const requests = [
        apiJson("/api/health", { cache: "no-store" }),
        ...(isAdmin ? [apiJson("/api/admin/errors?activeOnly=true", { cache: "no-store" })] : []),
      ];
      const [healthResult, adminResult] = await Promise.allSettled(requests);
      if (!mounted) return;

      if (healthResult.status === "rejected" || !healthResult.value?.ok) {
        setWorkspaceHealth({
          state: "unavailable",
          label: "Service unavailable",
          detail: "The application service could not be reached.",
        });
      } else if (healthResult.value.status !== "healthy" || healthResult.value.mongo !== 1) {
        const databaseConnecting = healthResult.value.mongo === 2;
        setWorkspaceHealth({
          state: databaseConnecting ? "attention" : "unavailable",
          label: databaseConnecting ? "Service starting" : "Service issue",
          detail: databaseConnecting
            ? "The database connection is still starting."
            : "The application database is not connected.",
        });
      } else if (isAdmin && adminResult) {
        if (adminResult.status === "rejected" || !adminResult.value?.ok) {
          setWorkspaceHealth({
            state: "attention",
            label: "Diagnostics unavailable",
            detail: "The application is online, but current provider health could not be checked.",
          });
        } else {
          const providerIssues = Array.isArray(adminResult.value.providerIssues) ? adminResult.value.providerIssues.length : 0;

          setWorkspaceHealth(
            providerIssues > 0
              ? {
                  state: "attention",
                  label: "Needs attention",
                  detail: `${providerIssues} enabled provider${providerIssues === 1 ? "" : "s"} currently reporting an error. Open Errors for details.`,
                }
              : {
                  state: "healthy",
                  label: "All systems operational",
                  detail: "Application and database are available; enabled providers have no active errors.",
                },
          );
        }
      } else {
        setWorkspaceHealth({
          state: "healthy",
          label: "All systems operational",
          detail: "Application and database services are available.",
        });
      }

      timer = setTimeout(() => {
        void refreshWorkspaceHealth();
      }, 30_000);
    }

    void refreshWorkspaceHealth();
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [isAdmin, user]);

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <ContentLoading label="Loading your workspace..." />
      </main>
    );
  }

  if (!user) return null;

  const links = isAdmin ? adminLinks : userLinks;
  const navigationGroups = isAdmin
    ? [{ label: "Workspace", items: links }]
    : [
        { label: "Workspace", items: links.slice(0, 2) },
        { label: "Manage", items: links.slice(2, 6) },
        { label: "Account", items: links.slice(6) },
      ];
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
    <div className={`app-shell min-h-screen ${isAdmin ? "app-shell-admin" : "app-shell-user"}`}>
      {user.requiresPhone && (
        <RequiredGooglePhoneModal
          onComplete={(phone) => setUser((current) => current ? { ...current, phone, requiresPhone: false } : current)}
        />
      )}
      <aside className="app-sidebar fixed inset-y-0 left-0 hidden w-64 overflow-y-auto border-r px-4 py-5 lg:block">
        <div className="flex h-full flex-col">
          <Link href={isAdmin ? "/admin" : "/dashboard/services"} className="app-brand flex items-center gap-3 px-2 py-1">
            <span className="brand-mark grid size-11 place-items-center rounded-2xl text-sm font-extrabold tracking-tight text-white">
              SP
            </span>
            <span>
              <span className="block text-sm font-bold tracking-tight">{isAdmin ? "Admin Panel" : "SMM Studio"}</span>
              <span className="mt-0.5 block text-[11px] font-medium text-neutral-500">
                {isAdmin ? "Operations console" : "Your growth workspace"}
              </span>
            </span>
          </Link>
          <div
            className="workspace-status-card mt-7 rounded-2xl border p-3"
            data-state={workspaceHealth.state}
            role="status"
            aria-live="polite"
            aria-label={isAdmin ? workspaceHealth.detail : `Workspace status: ${workspaceHealth.label}`}
            title={isAdmin ? workspaceHealth.detail : undefined}
          >
            <div className="workspace-status-label flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em]">
              <span className="workspace-status-indicator size-2 shrink-0 rounded-full" aria-hidden="true" />
              {isAdmin ? workspaceHealth.label : "Workspace active"}
            </div>
            <p className="mt-2 truncate text-xs text-neutral-600">{user?.name || user?.email || "Your account"}</p>
            {isAdmin && workspaceHealth.state !== "healthy" && workspaceHealth.state !== "checking" && (
              <p className="workspace-status-detail mt-1 text-[11px] leading-4">{workspaceHealth.detail}</p>
            )}
            {isAdmin && workspaceHealth.state === "attention" && (
              <Link href="/admin/errors" className="workspace-status-link mt-1 inline-block text-[11px] font-semibold">
                View diagnostics
              </Link>
            )}
          </div>
          <nav className="mt-7 flex-1 space-y-6 pb-6">
            {navigationGroups.map((group) => (
              <div key={group.label}>
                <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-400">
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={item.label}
                      aria-label={item.label}
                      className={`app-nav-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all duration-200 ${
                        isActive(item.href)
                          ? "bg-teal-50 text-teal-900 shadow-sm ring-1 ring-teal-700/10"
                          : "text-neutral-600 hover:translate-x-0.5 hover:bg-neutral-100/80 hover:text-neutral-950"
                      }`}
                    >
                      <item.icon className="size-[17px]" strokeWidth={1.8} />
                      <span className="app-nav-label">{item.label}</span>
                      {item.href === "/dashboard/services" && (
                        <span className="app-nav-badge ml-auto rounded-full bg-teal-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-teal-800">New</span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
          {!isAdmin && (
            <Link href="/dashboard/tickets" className="app-support-card mb-4 rounded-2xl bg-slate-950 p-4 text-white">
              <span className="grid size-9 place-items-center rounded-xl bg-white/10 text-teal-200">
                <CircleHelp className="size-4" />
              </span>
              <span className="mt-3 block text-xs font-bold">Need a hand?</span>
              <span className="mt-1 block text-[11px] leading-5 text-slate-300">Our support team is one message away.</span>
            </Link>
          )}
          <div className="border-t border-neutral-200 pt-3 text-[10px] font-medium text-neutral-400">
            SMM Studio <span className="float-right">v1.0</span>
          </div>
        </div>
      </aside>

      <div className="min-w-0 lg:pl-64">
        <header className="app-header sticky top-0 z-20 border-b px-3 py-3 sm:px-6">
          <div className="mx-auto max-w-[1440px]">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <Link href={isAdmin ? "/admin" : "/dashboard/services"} className="flex min-w-0 items-center gap-2 font-semibold lg:hidden">
                <span className="brand-mark grid size-9 shrink-0 place-items-center rounded-xl text-xs font-bold text-white">SP</span>
                <span className="truncate">{isAdmin ? "Admin Panel" : "SMM Panel"}</span>
              </Link>
              <div className="hidden min-w-0 items-center gap-2 text-xs font-medium text-neutral-500 lg:flex">
                <span>Workspace</span>
                <span className="text-neutral-300">/</span>
                <span className="truncate font-semibold text-neutral-800">
                  {links.find((item) => isActive(item.href))?.label ?? "Overview"}
                </span>
              </div>
              <div className="ml-auto flex min-w-0 items-center gap-2 text-sm sm:gap-3">
                {!isAdmin && (
                  <Link href="/dashboard/services" className="hidden items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-600 shadow-sm transition hover:border-teal-200 hover:text-teal-800 md:inline-flex">
                    <Search className="size-3.5" />
                    Find a service
                    <kbd className="ml-2 rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">⌘ K</kbd>
                  </Link>
                )}
                <Link href={isAdmin ? "/admin" : "/dashboard/profile"} className="hidden min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-neutral-100 sm:flex">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-teal-600 to-cyan-700 text-xs font-bold uppercase text-white">
                    {(user?.name || user?.email || "U").slice(0, 1)}
                  </span>
                  <span className="hidden min-w-0 text-left xl:block">
                    <span className="block max-w-44 truncate text-xs font-semibold text-neutral-800">{user?.name || "Account"}</span>
                    <span className="block max-w-44 truncate text-[10px] text-neutral-500">{user?.email}</span>
                  </span>
                </Link>
                <form onSubmit={logout} className="shrink-0">
                  <button aria-label="Logout" className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white/80 px-2.5 py-2 text-sm font-semibold shadow-sm hover:border-neutral-300 hover:bg-white sm:px-3">
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
