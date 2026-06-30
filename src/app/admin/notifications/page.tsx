import { AdminEmptyState, AdminHeader, AdminSection } from "@/components/admin-ui";
import { AppShell } from "@/components/app-shell";
import { requireAdmin } from "@/lib/auth";
import { Notification } from "@/models";
import { Bell } from "lucide-react";

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
      <AdminHeader
        eyebrow="Communications"
        title="Notification center"
        description="Recent in-app notifications across customers and system events."
      />
      <AdminSection title="Notification log" description="Latest in-app messages sent to users" icon={Bell}>
        {notifications.map((notification) => (
          <div key={String(notification._id)} className="grid gap-3 border-b border-neutral-100 p-4 text-sm md:grid-cols-[minmax(0,1fr)_220px_160px] md:items-center">
            <div className="min-w-0">
              <p className="font-semibold text-neutral-950">{notification.title}</p>
              {notification.body && <p className="text-neutral-600">{notification.body}</p>}
            </div>
            <span>{notification.user?.email ?? "System"}</span>
            <span className="text-neutral-500">{new Date(notification.createdAt).toLocaleString()}</span>
          </div>
        ))}
        {notifications.length === 0 && <AdminEmptyState icon={Bell} title="No notifications yet" description="System and user notifications will appear here." />}
      </AdminSection>
    </AppShell>
  );
}
