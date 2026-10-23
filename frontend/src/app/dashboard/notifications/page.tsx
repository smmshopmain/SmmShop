import { ActionButton } from "@/components/admin-controls";
import { AppShell } from "@/components/app-shell";
import { serverApiJson } from "@/lib/server-api";
import { Bell, CheckCircle2 } from "lucide-react";

export default async function NotificationsPage() {
  let notifications: Array<{
    _id: string;
    title: string;
    body?: string;
    readAt?: string;
    createdAt: string;
  }> = [];

  try {
    const result = await serverApiJson("/api/notifications");
    notifications = Array.isArray(result.notifications) ? result.notifications : [];
  } catch {
    notifications = [];
  }

  return (
    <AppShell>
      <section className="notifications-command mb-6 grid gap-5 overflow-hidden rounded-[1.7rem] border border-neutral-200 bg-white p-5 shadow-sm sm:p-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div>
          <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-teal-800">
            <Bell className="size-3.5" /> Workspace updates
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-neutral-950">Your notifications</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">Order, deposit, ticket, and account updates appear here.</p>
          <p className="mt-4 text-xs font-semibold text-neutral-500">
            {notifications.filter((item) => !item.readAt).length} unread · {notifications.length} total
          </p>
        </div>
        {notifications.some((item) => !item.readAt) && (
          <div className="notifications-mark-all">
            <ActionButton label="Mark all read" endpoint="/api/notifications" body={{ action: "read_all" }} />
          </div>
        )}
      </section>
      <section className="notifications-list overflow-hidden rounded-[1.5rem] border border-neutral-200 bg-white shadow-sm">
        {notifications.map((notification) => (
          <div
            key={String(notification._id)}
            className={`grid gap-3 border-b border-neutral-100 p-4 text-sm md:grid-cols-[minmax(0,1fr)_170px_120px] md:items-center ${
              notification.readAt ? "bg-white" : "bg-teal-50/50"
            }`}
          >
            <div className="flex min-w-0 gap-3">
              <span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-md ${notification.readAt ? "bg-neutral-100 text-neutral-500" : "bg-teal-100 text-teal-800"}`}>
                {notification.readAt ? <CheckCircle2 className="size-4" /> : <Bell className="size-4" />}
              </span>
              <span className="min-w-0">
              <p className="font-semibold text-neutral-950">{notification.title}</p>
              {notification.body && <p className="mt-1 text-neutral-600">{notification.body}</p>}
              </span>
            </div>
            <span className="text-neutral-500">{new Date(notification.createdAt).toLocaleString()}</span>
            {notification.readAt ? (
              <span className="text-xs font-semibold text-neutral-400">Read</span>
            ) : (
              <ActionButton label="Mark read" endpoint="/api/notifications" body={{ id: String(notification._id), action: "read" }} />
            )}
          </div>
        ))}
        {notifications.length === 0 && (
          <div className="grid place-items-center px-4 py-12 text-center">
            <Bell className="size-10 text-neutral-300" />
            <p className="mt-3 text-sm font-semibold text-neutral-800">No notifications yet</p>
            <p className="mt-1 max-w-md text-sm text-neutral-500">Important account updates will appear here.</p>
          </div>
        )}
      </section>
    </AppShell>
  );
}
