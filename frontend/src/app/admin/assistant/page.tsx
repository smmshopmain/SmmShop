"use client";

import { AdminHeader } from "@/components/admin-ui";
import { AIAssistantWorkspace } from "@/components/ai-assistant-workspace";
import { AppShell } from "@/components/app-shell";

export default function AdminAssistantPage() {
  return (
    <AppShell>
      <AdminHeader
        eyebrow="Operations copilot"
        title="AI assistant"
        description="Create and schedule campaign drafts, review workspace activity, and manage supported website appearance settings with natural-language instructions."
      />
      <AIAssistantWorkspace admin />
    </AppShell>
  );
}
