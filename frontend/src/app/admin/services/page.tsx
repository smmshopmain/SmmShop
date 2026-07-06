"use client";

import { useEffect, useState } from "react";
import { ActionButton, ServiceAdminList, SyncStatusPanel, type AdminServiceItem } from "@/components/admin-controls";
import { AdminHeader } from "@/components/admin-ui";
import { AppShell } from "@/components/app-shell";
import { apiJson } from "@/lib/client-api";

export default function AdminServicesPage() {
  const [services, setServices] = useState<AdminServiceItem[]>([]);

  useEffect(() => {
    let mounted = true;

    apiJson("/api/admin/services")
      .then(({ services: records = [] }) => {
        if (!mounted) return;
        setServices(
          (records as Array<Omit<AdminServiceItem, "_id"> & { _id: unknown }>).map((service) => ({
            ...service,
            _id: String(service._id),
            provider: service.provider ? { name: service.provider.name } : undefined,
          })),
        );
      })
      .catch(() => {
        if (mounted) setServices([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

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
