import { ActionButton, WalletAdjustForm } from "@/components/admin-controls";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { requireAdmin } from "@/lib/auth";
import { User } from "@/models";

export default async function UsersPage() {
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
    users = (await User.find().select("-passwordHash").sort({ createdAt: -1 }).limit(100).lean()) as typeof users;
  } catch {
    users = [];
  }

  return (
    <AppShell>
      <h1 className="mb-6 text-2xl font-semibold">User management</h1>
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
            <WalletAdjustForm userId={String(user._id)} />
          </div>
        ))}
        {users.length === 0 && <p className="p-4 text-sm text-neutral-500">No users found.</p>}
      </section>
    </AppShell>
  );
}
