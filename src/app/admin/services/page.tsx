import { ActionButton, ServiceAdminList, SyncStatusPanel, type AdminServiceItem } from "@/components/admin-controls";
import { AppShell } from "@/components/app-shell";
import { requireAdmin } from "@/lib/auth";
import { Service } from "@/models";

export default async function AdminServicesPage() {
  let services: AdminServiceItem[] = [];

  try {
    await requireAdmin();
    const records = (await Service.find()
      .populate("provider", "name")
      .sort({ category: 1, name: 1 })
      .limit(250)
      .lean()) as Array<Omit<AdminServiceItem, "_id"> & { _id: unknown }>;
    services = records.map((service) => ({
      ...service,
      _id: String(service._id),
      provider: service.provider ? { name: service.provider.name } : undefined,
    }));
  } catch {
    services = [];
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Service admin</h1>
        <p className="mt-1 text-sm text-neutral-600">Control service visibility and service-level margins.</p>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <ActionButton label="Import services" endpoint="/api/cron/service-sync" method="GET" />
        <ActionButton label="Sync services" endpoint="/api/cron/service-sync" method="GET" />
        <ActionButton label="Recalculate prices" endpoint="/api/cron/price-sync" method="GET" />
      </div>
      <SyncStatusPanel />
      <ServiceAdminList services={services} />
    </AppShell>
  );
}
