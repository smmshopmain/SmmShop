import { ActionButton, ServiceMarginForm } from "@/components/admin-controls";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { requireAdmin } from "@/lib/auth";
import { Service } from "@/models";

export default async function AdminServicesPage() {
  let services: Array<{
    _id: string;
    name: string;
    category: string;
    providerRate: number;
    sellingRate: number;
    min: number;
    max: number;
    active: boolean;
    marginPercent?: number;
    provider?: { name?: string };
  }> = [];

  try {
    await requireAdmin();
    services = (await Service.find()
      .populate("provider", "name")
      .sort({ category: 1, name: 1 })
      .limit(250)
      .lean()) as typeof services;
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
      <section className="rounded-md border border-neutral-200 bg-white">
        {services.map((service) => (
          <div key={String(service._id)} className="grid gap-3 border-b border-neutral-100 p-4 text-sm xl:grid-cols-[1fr_140px_120px_120px_220px]">
            <div>
              <p className="font-medium">{service.name}</p>
              <p className="text-neutral-500">
                {service.category} / {service.provider?.name ?? "Provider"} / {service.min}-{service.max}
              </p>
            </div>
            <span>Cost Rs.{service.providerRate}/1k</span>
            <strong>Sell Rs.{service.sellingRate}/1k</strong>
            <StatusBadge status={service.active ? "Approved" : "Canceled"} />
            <div className="flex flex-wrap items-center gap-2">
              <ServiceMarginForm serviceId={String(service._id)} currentMargin={service.marginPercent} />
              <ActionButton
                label={service.active ? "Disable" : "Enable"}
                endpoint="/api/admin/services"
                body={{ id: String(service._id), active: !service.active }}
                danger={service.active}
              />
            </div>
          </div>
        ))}
        {services.length === 0 && <p className="p-4 text-sm text-neutral-500">No services imported yet. Run service sync after adding a provider.</p>}
      </section>
    </AppShell>
  );
}
