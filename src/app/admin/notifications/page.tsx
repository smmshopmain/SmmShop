import { AppShell } from "@/components/app-shell";
import { requireAdmin } from "@/lib/auth";
import { Notification } from "@/models";

export default async function AdminNotificationsPage() {
  let notifications: Array<{
    _id: string;
    title: string;
    body?: string;
    readAt?: Date;
    createdAt: Date;
    user?: { email?: string };
  }> = [];

  try {
    await requireAdmin();
    notifications = (await Notification.find()
      .populate("user", "email")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean()) as typeof notifications;
  } catch {
    notifications = [];
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Notification center</h1>
        <p className="mt-1 text-sm text-neutral-600">Recent in-app notifications across users.</p>
      </div>
      <section className="rounded-md border border-neutral-200 bg-white">
        {notifications.map((notification) => (
          <div key={String(notification._id)} className="grid gap-3 border-b border-neutral-100 p-4 text-sm md:grid-cols-[1fr_220px_160px]">
            <div>
              <p className="font-medium">{notification.title}</p>
              {notification.body && <p className="text-neutral-600">{notification.body}</p>}
            </div>
            <span>{notification.user?.email ?? "System"}</span>
            <span className="text-neutral-500">{new Date(notification.createdAt).toLocaleString()}</span>
          </div>
        ))}
        {notifications.length === 0 && <p className="p-4 text-sm text-neutral-500">No notifications yet.</p>}
      </section>
    </AppShell>
  );
}
