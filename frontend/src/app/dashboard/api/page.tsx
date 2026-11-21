"use client";

import { AppShell } from "@/components/app-shell";
import { AdminHeader } from "@/components/admin-ui";
import { ResellerApiKeys } from "@/components/reseller-api-keys";

export default function UserApiPage() {
  return (
    <AppShell>
      <AdminHeader
        eyebrow="Developer access"
        title="Reseller API"
        description="Manage your API credentials, review integration examples, and connect your own storefront."
      />
      <ResellerApiKeys />
    </AppShell>
  );
}
