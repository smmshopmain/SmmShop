import { ActionButton, AdminResetPasswordForm, WalletAdjustForm } from "@/components/admin-controls";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { requireAdmin } from "@/lib/auth";
import { User } from "@/models";

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

  try {
    await requireAdmin();
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
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">User management</h1>
          <p className="mt-1 text-sm text-neutral-600">Search users, control access, wallet state, and password resets.</p>
        </div>
        <form className="flex gap-2" action="/admin/users">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search users"
            className="w-56 rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <button className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white">Search</button>
        </form>
      </div>
      <section className="rounded-md border border-neutral-200 bg-white">
        {users.map((user) => (
          <div key={String(user._id)} className="grid gap-3 border-b border-neutral-100 p-4 text-sm">
            <div className="grid gap-2 md:grid-cols-[1fr_100px_120px_100px]">
              <div>
                <p className="font-medium">{user.name}</p>
                <p className="text-neutral-500">{user.email}</p>
              </div>
              <span>{user.role}</span>
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
            </div>
            <AdminResetPasswordForm userId={String(user._id)} />
            <WalletAdjustForm userId={String(user._id)} />
          </div>
        ))}
        {users.length === 0 && <p className="p-4 text-sm text-neutral-500">No users found.</p>}
      </section>
    </AppShell>
  );
}
