import { ActionButton } from "@/components/admin-controls";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { Notification } from "@/models";
import { Bell, CheckCircle2 } from "lucide-react";

export default async function NotificationsPage() {
  let notifications: Array<{
    _id: string;
    title: string;
    body?: string;
    readAt?: Date;
    createdAt: Date;
  }> = [];

  try {
    const { auth } = await requireUser();
    notifications = (await Notification.find({ user: auth.id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()) as typeof notifications;
  } catch {
    notifications = [];
  }

  return (
    <AppShell>
      <div className="mb-6 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
            <p className="text-xs font-bold uppercase tracking-wide text-teal-700">Updates</p>
            <h1 className="mt-2 text-2xl font-bold text-neutral-950 sm:text-3xl">Notifications</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">Order, deposit, ticket aur account updates yahan milenge.</p>
        </div>
        {notifications.some((item) => !item.readAt) && (
          <ActionButton label="Mark all read" endpoint="/api/notifications" body={{ action: "read_all" }} />
        )}
        </div>
      </div>
      <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
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
            <p className="mt-1 max-w-md text-sm text-neutral-500">Important account updates yahan show honge.</p>
          </div>
        )}
      </section>
    </AppShell>
  );
}
