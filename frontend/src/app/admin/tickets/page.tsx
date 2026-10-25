import { AppShell } from "@/components/app-shell";
import { SupportDesk } from "@/components/support-desk";

export default function AdminTicketsPage() {
  return (
    <AppShell>
      <SupportDesk mode="admin" />
    </AppShell>
  );
}
