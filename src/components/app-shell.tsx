import Link from "next/link";
import {
  BadgeIndianRupee,
  CircleHelp,
  Gauge,
  History,
  Layers3,
  LineChart,
  Settings,
  Shield,
  Tags,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";
import { currentUser } from "@/lib/auth";

const userLinks = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/dashboard/services", label: "Services", icon: Layers3 },
  { href: "/dashboard/orders", label: "Orders", icon: History },
  { href: "/dashboard/wallet", label: "Wallet", icon: Wallet },
  { href: "/dashboard/referrals", label: "Referrals", icon: BadgeIndianRupee },
  { href: "/dashboard/tickets", label: "Tickets", icon: Ticket },
];

const adminLinks = [
  { href: "/admin", label: "Admin", icon: Shield },
  { href: "/admin/providers", label: "Providers", icon: Layers3 },
  { href: "/admin/services", label: "Service Admin", icon: Layers3 },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/deposits", label: "Deposits", icon: CircleHelp },
  { href: "/admin/promo-codes", label: "Promo Codes", icon: Tags },
  { href: "/admin/tickets", label: "Support", icon: Ticket },
  { href: "/admin/analytics", label: "Analytics", icon: LineChart },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const links = user?.role === "admin" ? [...userLinks, ...adminLinks] : userLinks;

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-neutral-200 bg-white px-4 py-5 lg:block">
        <Link href="/dashboard" className="flex items-center gap-3 px-2">
          <span className="grid size-10 place-items-center rounded-md bg-teal-700 text-sm font-bold text-white">
            SP
          </span>
          <span>
            <span className="block text-sm font-semibold">SMM Panel</span>
            <span className="block text-xs text-neutral-500">Reseller platform</span>
          </span>
        </Link>
        <nav className="mt-8 space-y-1">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-amber-50 hover:text-neutral-950"
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <Link href="/dashboard" className="font-semibold lg:hidden">
              SMM Panel
            </Link>
            <nav className="flex gap-2 overflow-x-auto lg:hidden">
              {links.slice(0, 5).map((item) => (
                <Link key={item.href} href={item.href} className="rounded-md px-3 py-2 text-xs font-medium">
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-3 text-sm">
              <span className="hidden text-neutral-600 sm:block">{user?.email}</span>
              <form action="/api/auth/logout" method="post">
                <button className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100">
                  Logout
                </button>
              </form>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
