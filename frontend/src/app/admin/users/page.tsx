"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ActionButton, AdminResetPasswordForm, WalletAdjustForm } from "@/components/admin-controls";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { apiJson } from "@/lib/client-api";

export default function UsersPage() {
  const searchParams = useSearchParams();
  const q = (searchParams.get("q") ?? "").trim();
  const [users, setUsers] = useState<Array<any>>([]);
  const [currentAdminId, setCurrentAdminId] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const [me, usersRes] = await Promise.allSettled([apiJson("/api/auth/me"), apiJson(`/api/admin/users?q=${encodeURIComponent(q)}`)]);
        if (mounted && me.status === "fulfilled" && me.value?.user) setCurrentAdminId(me.value.user.id ?? "");
        if (mounted && usersRes.status === "fulfilled") {
          const payload = usersRes.value?.data ?? usersRes.value ?? [];
          setUsers(Array.isArray(payload) ? payload : payload.users ?? []);
        }
      } catch {
        if (mounted) setUsers([]);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [q]);

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">User management</h1>
          <p className="mt-1 text-sm text-neutral-600">Search users, control access, wallet state, and password resets.</p>
        </div>
        <form className="flex gap-2" action="/admin/users">
          <input name="q" defaultValue={q} placeholder="Search users" className="w-56 rounded-md border border-neutral-300 px-3 py-2 text-sm" />
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
              <ActionButton label={user.isBanned ? "Unban" : "Ban"} endpoint="/api/admin/users" body={{ id: String(user._id), action: user.isBanned ? "unban" : "ban" }} danger={!user.isBanned} />
              <ActionButton label={user.walletFrozen ? "Unfreeze wallet" : "Freeze wallet"} endpoint="/api/admin/users" body={{ id: String(user._id), action: user.walletFrozen ? "unfreeze_wallet" : "freeze_wallet" }} danger={!user.walletFrozen} />
              {String(user._id) !== currentAdminId && (
                <ActionButton label="Delete" endpoint="/api/admin/users" method="DELETE" body={{ id: String(user._id) }} danger confirmMessage={`Delete ${user.name} (${user.email})? This cannot be undone.`} />
              )}
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
