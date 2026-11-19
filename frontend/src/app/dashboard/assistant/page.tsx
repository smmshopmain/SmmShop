"use client";

import { AdminHeader } from "@/components/admin-ui";
import { AIAssistantWorkspace } from "@/components/ai-assistant-workspace";
import { AppShell } from "@/components/app-shell";

export default function UserAssistantPage() {
  return (
    <AppShell>
      <AdminHeader
        eyebrow="Customer help"
        title="AI assistant"
        description="Find active services, review your recent orders, and create a support request."
      />
      <AIAssistantWorkspace admin={false} />
    </AppShell>
  );
}
