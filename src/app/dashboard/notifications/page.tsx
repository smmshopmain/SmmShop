import { ActionButton } from "@/components/admin-controls";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { Notification } from "@/models";

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
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Notifications</h1>
          <p className="mt-1 text-sm text-neutral-600">Order, deposit, ticket, and account updates.</p>
        </div>
        {notifications.some((item) => !item.readAt) && (
          <ActionButton label="Mark all read" endpoint="/api/notifications" body={{ action: "read_all" }} />
        )}
      </div>
      <section className="rounded-md border border-neutral-200 bg-white">
        {notifications.map((notification) => (
          <div key={String(notification._id)} className="grid gap-3 border-b border-neutral-100 p-4 text-sm md:grid-cols-[1fr_150px_120px]">
            <div>
              <p className="font-medium">{notification.title}</p>
              {notification.body && <p className="mt-1 text-neutral-600">{notification.body}</p>}
            </div>
            <span className="text-neutral-500">{new Date(notification.createdAt).toLocaleString()}</span>
            {notification.readAt ? (
              <span className="text-xs text-neutral-400">Read</span>
            ) : (
              <ActionButton label="Mark read" endpoint="/api/notifications" body={{ id: String(notification._id), action: "read" }} />
            )}
          </div>
        ))}
        {notifications.length === 0 && <p className="p-4 text-sm text-neutral-500">No notifications yet.</p>}
      </section>
    </AppShell>
  );
}
