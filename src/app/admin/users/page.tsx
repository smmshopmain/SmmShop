import { ActionButton, AdminResetPasswordForm, WalletAdjustForm } from "@/components/admin-controls";
import { AdminEmptyState, AdminHeader, AdminSection } from "@/components/admin-ui";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { requireAdmin } from "@/lib/auth";
import { User } from "@/models";
import { Search, Users } from "lucide-react";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default async function UsersPage({ searchParams }: { searchParams?: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const q = params?.q?.trim() ?? "";
  let users: Array<{
    _id: string;
    name: string;
    email: string;
    walletBalance: number;
    isBanned: boolean;
    walletFrozen: boolean;
    role: string;
  }> = [];
  let currentAdminId = "";

  try {
    const { auth } = await requireAdmin();
    currentAdminId = auth.id;
    const filter = q
      ? {
          $or: [
            { email: new RegExp(escapeRegExp(q), "i") },
            { name: new RegExp(escapeRegExp(q), "i") },
            { phone: new RegExp(escapeRegExp(q), "i") },
          ],
        }
      : {};
    users = (await User.find(filter).select("-passwordHash").sort({ createdAt: -1 }).limit(100).lean()) as typeof users;
  } catch {
    users = [];
  }

  return (
    <AppShell>
      <AdminHeader
        eyebrow="Customer operations"
        title="User management"
        description="Search users, control access, wallet state, password resets, and manual wallet adjustments."
        actions={
        <form className="flex gap-2" action="/admin/users">
          <label className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-neutral-400" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search users"
              className="h-11 w-64 rounded-md border border-neutral-300 bg-white pl-9 pr-3 text-sm shadow-sm focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
            />
          </label>
          <button className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800">Search</button>
        </form>
        }
      />
      <AdminSection title="User accounts" description="Access controls and wallet tools" icon={Users}>
        {users.map((user) => (
          <div key={String(user._id)} className="grid gap-3 border-b border-neutral-100 p-4 text-sm">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_100px_120px_110px] md:items-center">
              <div className="min-w-0">
                <p className="font-semibold text-neutral-950">{user.name}</p>
                <p className="text-neutral-500">{user.email}</p>
              </div>
              <span className="rounded-md bg-neutral-100 px-2 py-1 text-center text-xs font-semibold capitalize text-neutral-700">{user.role}</span>
              <StatusBadge status={user.isBanned || user.walletFrozen ? "Canceled" : "Approved"} />
              <strong>Rs.{user.walletBalance}</strong>
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionButton
                label={user.isBanned ? "Unban" : "Ban"}
                endpoint="/api/admin/users"
                body={{ id: String(user._id), action: user.isBanned ? "unban" : "ban" }}
                danger={!user.isBanned}
              />
              <ActionButton
                label={user.walletFrozen ? "Unfreeze wallet" : "Freeze wallet"}
                endpoint="/api/admin/users"
                body={{ id: String(user._id), action: user.walletFrozen ? "unfreeze_wallet" : "freeze_wallet" }}
                danger={!user.walletFrozen}
              />
              {String(user._id) !== currentAdminId && (
                <ActionButton
                  label="Delete"
                  endpoint="/api/admin/users"
                  method="DELETE"
                  body={{ id: String(user._id) }}
                  danger
                  confirmMessage={`Delete ${user.name} (${user.email})? This cannot be undone.`}
                />
              )}
            </div>
            <AdminResetPasswordForm userId={String(user._id)} />
            <WalletAdjustForm userId={String(user._id)} />
          </div>
        ))}
        {users.length === 0 && <AdminEmptyState icon={Users} title="No users found" description="Try another search term or check whether users have registered." />}
      </AdminSection>
    </AppShell>
  );
}
