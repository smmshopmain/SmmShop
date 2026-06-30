import { ActionButton, ServiceAdminList, SyncStatusPanel, type AdminServiceItem } from "@/components/admin-controls";
import { AdminHeader } from "@/components/admin-ui";
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
      <AdminHeader
        eyebrow="Catalog operations"
        title="Service admin"
        description="Control service visibility, category/service margins, and provider catalog sync."
        actions={
          <>
            <ActionButton label="Import services" endpoint="/api/cron/service-import" method="GET" />
            <ActionButton label="Sync services" endpoint="/api/cron/service-sync" method="GET" />
            <ActionButton label="Recalculate prices" endpoint="/api/cron/price-sync" method="GET" />
          </>
        }
      />
      <SyncStatusPanel />
      <ServiceAdminList services={services} />
    </AppShell>
  );
}
