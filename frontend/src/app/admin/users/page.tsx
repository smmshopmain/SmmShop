"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ActionButton, AdminResetPasswordForm, UserRoleForm, WalletAdjustForm } from "@/components/admin-controls";
import { AdminEmptyState, AdminHeader, AdminSection } from "@/components/admin-ui";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { apiFetch, apiJson } from "@/lib/client-api";
import { roleLabel } from "@/lib/roles";
import { LoginHistoryEntry, LoginHistoryList } from "@/components/login-history-list";
import { Search, Users } from "lucide-react";

export default function UsersPage() {
  const searchParams = useSearchParams();
  const q = (searchParams.get("q") ?? "").trim();
  const [users, setUsers] = useState<Array<{
    _id: string;
    name?: string;
    email?: string;
    role?: string;
    walletBalance?: number;
    isBanned?: boolean;
    walletFrozen?: boolean;
    loginHistory?: LoginHistoryEntry[];
  }>>([]);
  const [currentAdminId, setCurrentAdminId] = useState("");
  const [currentAdminRole, setCurrentAdminRole] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");
  const manageableUsers = users.filter((user) => {
    const userId = String(user._id);
    const isMainAdminTarget = user.role === "admin";
    return userId !== currentAdminId
      && currentAdminRole !== "staff"
      && !(currentAdminRole !== "admin" && isMainAdminTarget);
  });
  const manageableIds = new Set(manageableUsers.map((user) => String(user._id)));
  const selectedManageableIds = selectedIds.filter((id) => manageableIds.has(id));
  const allManageableSelected = manageableUsers.length > 0
    && selectedManageableIds.length === manageableUsers.length;

  function toggleUser(userId: string) {
    setSelectedIds((current) => current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId]);
  }

  function toggleAllUsers() {
    setSelectedIds((current) => {
      const currentVisibleIds = new Set(manageableUsers.map((user) => String(user._id)));
      const withoutVisible = current.filter((id) => !currentVisibleIds.has(id));
      return allManageableSelected
        ? withoutVisible
        : [...withoutVisible, ...currentVisibleIds];
    });
  }

  async function setSelectedUsersEnabled(enabled: boolean) {
    if (selectedManageableIds.length === 0) return;
    setBulkLoading(true);
    setBulkMessage("");
    try {
      const response = await apiFetch("/api/admin/users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ids: selectedManageableIds,
          action: enabled ? "unban" : "ban",
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setBulkMessage(result.message ?? "Unable to update selected users.");
        return;
      }
      window.location.reload();
    } catch (error) {
      setBulkMessage(error instanceof Error ? error.message : "Unable to update selected users.");
    } finally {
      setBulkLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const [me, usersRes] = await Promise.allSettled([apiJson("/api/auth/me"), apiJson(`/api/admin/users?q=${encodeURIComponent(q)}`)]);
        if (mounted && me.status === "fulfilled") {
          const mePayload = me.value?.user ?? me.value?.data ?? me.value ?? {};
          setCurrentAdminId(mePayload.id ?? "");
          setCurrentAdminRole(mePayload.role ?? "");
        }
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
      <AdminHeader
        eyebrow="Customer operations"
        title="User management"
        description="Search users, control access, wallet state, password resets, and manual wallet adjustments."
        actions={
        <form className="flex gap-2" action="/admin/users">
          <label className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-neutral-400" />
            <input name="q" defaultValue={q} placeholder="Search users" className="h-11 w-64 rounded-md border border-neutral-300 bg-white pl-9 pr-3 text-sm shadow-sm focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10" />
          </label>
          <button className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800">Search</button>
        </form>
        }
      />
      <AdminSection title="User accounts" description="Access controls and wallet tools" icon={Users}>
        {manageableUsers.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-neutral-200 bg-neutral-50 p-4 text-sm">
            <label className="flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={allManageableSelected}
                onChange={toggleAllUsers}
                className="size-4 rounded border-neutral-300"
                aria-label="Select all manageable users"
              />
              Select all ({manageableUsers.length})
            </label>
            <button
              type="button"
              onClick={() => void setSelectedUsersEnabled(true)}
              disabled={bulkLoading || selectedManageableIds.length === 0}
              className="rounded-md bg-teal-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {bulkLoading ? "Updating..." : `Enable selected (${selectedManageableIds.length})`}
            </button>
            <button
              type="button"
              onClick={() => void setSelectedUsersEnabled(false)}
              disabled={bulkLoading || selectedManageableIds.length === 0}
              className="rounded-md bg-rose-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {bulkLoading ? "Updating..." : `Disable selected (${selectedManageableIds.length})`}
            </button>
            {bulkMessage && <span role="alert" className="text-xs text-rose-700">{bulkMessage}</span>}
          </div>
        )}
        {users.map((user) => {
          const userId = String(user._id);
          const isSelf = userId === currentAdminId;
          const isMainAdminTarget = user.role === "admin";
          const canModify = !isSelf && currentAdminRole !== "staff" && !(currentAdminRole !== "admin" && isMainAdminTarget);
          const canMainAdminChangeRole = currentAdminRole === "admin" && !isSelf && !isMainAdminTarget;

          return (
          <div key={userId} className="grid gap-3 border-b border-neutral-100 p-4 text-sm">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_100px_120px_110px] md:items-center">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {canModify && (
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(userId)}
                      onChange={() => toggleUser(userId)}
                      aria-label={`Select ${user.name ?? user.email ?? "user"}`}
                      className="size-4 shrink-0 rounded border-neutral-300"
                    />
                  )}
                  <p className="font-semibold text-neutral-950">{user.name}</p>
                </div>
                <p className="text-neutral-500">{user.email}</p>
              </div>
              <span className="rounded-md bg-neutral-100 px-2 py-1 text-center text-xs font-semibold text-neutral-700">{roleLabel(user.role)}</span>
              <StatusBadge status={user.isBanned || user.walletFrozen ? "Canceled" : "Approved"} />
              <strong>Rs.{user.walletBalance}</strong>
            </div>
            <details className="rounded-lg border border-neutral-200 px-3 py-2">
              <summary className="cursor-pointer text-xs font-semibold text-neutral-700">
                Recent sign-ins ({user.loginHistory?.length ?? 0})
              </summary>
              <LoginHistoryList entries={user.loginHistory ?? []} />
            </details>
            <div className="flex flex-wrap gap-2">
              {canModify && (
                <>
                  <ActionButton label={user.isBanned ? "Unban" : "Ban"} endpoint="/api/admin/users" body={{ id: userId, action: user.isBanned ? "unban" : "ban" }} danger={!user.isBanned} />
                  <ActionButton label={user.walletFrozen ? "Unfreeze wallet" : "Freeze wallet"} endpoint="/api/admin/users" body={{ id: userId, action: user.walletFrozen ? "unfreeze_wallet" : "freeze_wallet" }} danger={!user.walletFrozen} />
                </>
              )}
              {currentAdminRole === "admin" && !isSelf && !isMainAdminTarget && (
                <ActionButton label="Delete permanently" endpoint="/api/admin/users" method="DELETE" body={{ id: userId }} danger confirmMessage={`Permanently delete ${user.name} (${user.email}) and all associated orders, deposits, wallet history, tickets, notifications, and referral data? This cannot be undone. Their email and mobile number will be available for a new account.`} />
              )}
            </div>
            {canMainAdminChangeRole && <UserRoleForm userId={userId} currentRole={user.role ?? "user"} />}
            {canModify && <AdminResetPasswordForm userId={userId} />}
            {canModify && <WalletAdjustForm userId={userId} />}
          </div>
        );
        })}
        {users.length === 0 && <AdminEmptyState icon={Users} title="No users found" description="Try another search term or check whether users have registered." />}
      </AdminSection>
    </AppShell>
  );
}
